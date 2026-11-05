import { Router, type RequestHandler } from 'express';
import { can } from '@fluxo/shared';
import { ctx } from '../../lib/context';
import { badRequest, forbidden } from '../../lib/errors';
import { attachmentInclude, toAttachment } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';
import { realtimeBus } from '../../lib/realtime-bus';
import { logActivity } from '../activities/activity.logger';
import { requireAttachment, requireCard } from '../access';
import { loadCardSummary } from '../cards/card-summary';
import { deleteStoredFiles, sanitizeFileName, storedFilePath, upload } from './storage';

export function attachmentsRouter(uploadLimiter: RequestHandler) {
  const router = Router();

  router.post(
    '/cards/:cardId/attachments',
    uploadLimiter,
    // A permissão é verificada antes de qualquer byte ser gravado em disco.
    async (req, _res, next) => {
      await requireCard(ctx(req).userId, String(req.params.cardId), 'attachment:upload');
      next();
    },
    upload.single('file'),
    async (req, res) => {
      const context = ctx(req);
      const file = req.file;
      if (!file) throw badRequest('Envie um arquivo no campo "file"', 'FILE_MISSING');

      try {
        const { board, card } = await requireCard(
          context.userId,
          String(req.params.cardId),
          'attachment:upload',
        );
        const fileName = sanitizeFileName(file.originalname);
        const attachment = await prisma.attachment.create({
          data: {
            cardId: card.id,
            uploaderId: context.userId,
            fileName,
            storedName: file.filename,
            mimeType: file.mimetype,
            size: file.size,
          },
          include: attachmentInclude,
        });
        await logActivity({
          workspaceId: board.workspaceId,
          boardId: board.id,
          cardId: card.id,
          actorId: context.userId,
          type: 'attachment.added',
          data: { cardTitle: card.title, fileName },
        });
        realtimeBus.publishToBoard(context, board.id, {
          type: 'card.updated',
          card: await loadCardSummary(card.id),
        });
        res.status(201).json(toAttachment(attachment));
      } catch (error) {
        await deleteStoredFiles([file.filename]);
        throw error;
      }
    },
  );

  router.get('/attachments/:attachmentId/download', async (req, res) => {
    const { attachment } = await requireAttachment(ctx(req).userId, req.params.attachmentId);
    res.setHeader('Cache-Control', 'private, max-age=0, no-store');
    res.download(storedFilePath(attachment.storedName), attachment.fileName, {
      headers: { 'Content-Type': attachment.mimeType },
    });
  });

  router.delete('/attachments/:attachmentId', async (req, res) => {
    const context = ctx(req);
    const { board, role, attachment } = await requireAttachment(
      context.userId,
      req.params.attachmentId,
    );
    const isOwner = attachment.uploaderId === context.userId && can(role, 'attachment:upload');
    if (!isOwner && !can(role, 'attachment:moderate')) {
      throw forbidden('Você não pode remover este anexo');
    }
    await prisma.attachment.delete({ where: { id: attachment.id } });
    await deleteStoredFiles([attachment.storedName]);
    await logActivity({
      workspaceId: board.workspaceId,
      boardId: board.id,
      cardId: attachment.cardId,
      actorId: context.userId,
      type: 'attachment.removed',
      data: { cardTitle: attachment.card.title, fileName: attachment.fileName },
    });
    realtimeBus.publishToBoard(context, board.id, {
      type: 'card.updated',
      card: await loadCardSummary(attachment.cardId),
    });
    res.status(204).end();
  });

  return router;
}
