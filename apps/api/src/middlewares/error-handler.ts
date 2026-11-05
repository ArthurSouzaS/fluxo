import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { ZodError } from 'zod';
import type { ApiErrorBody } from '@fluxo/shared';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { env } from '../config/env';

function send(res: Response, status: number, error: ApiErrorBody['error']) {
  res.status(status).json({ error } satisfies ApiErrorBody);
}

export function notFoundHandler(req: Request, res: Response) {
  send(res, 404, {
    code: 'ROUTE_NOT_FOUND',
    message: `Rota não encontrada: ${req.method} ${req.path}`,
  });
}

// O Express identifica o handler de erro pelos 4 parâmetros.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return send(res, err.status, { code: err.code, message: err.message, details: err.details });
  }

  if (err instanceof ZodError) {
    return send(res, 400, {
      code: 'VALIDATION_ERROR',
      message: err.issues[0]?.message ?? 'Dados inválidos',
      details: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    });
  }

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return send(res, 413, {
        code: 'FILE_TOO_LARGE',
        message: `O arquivo deve ter no máximo ${env.UPLOAD_MAX_MB} MB`,
      });
    }
    return send(res, 400, { code: 'UPLOAD_ERROR', message: 'Envio de arquivo inválido' });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return send(res, 409, { code: 'CONFLICT', message: 'Registro duplicado' });
    }
    if (err.code === 'P2025') {
      return send(res, 404, { code: 'NOT_FOUND', message: 'Recurso não encontrado' });
    }
    if (err.code === 'P2003') {
      return send(res, 400, { code: 'INVALID_REFERENCE', message: 'Referência inválida' });
    }
  }

  // Erros do body-parser (JSON malformado, corpo grande demais).
  if (typeof err === 'object' && err !== null && 'type' in err && 'status' in err) {
    const status = Number((err as { status: number }).status);
    if ((err as { type: string }).type === 'entity.parse.failed') {
      return send(res, 400, {
        code: 'INVALID_JSON',
        message: 'JSON inválido no corpo da requisição',
      });
    }
    if (status === 413) {
      return send(res, 413, {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Corpo da requisição muito grande',
      });
    }
  }

  logger.error({ err, path: req.path, method: req.method }, 'Erro não tratado');
  return send(res, 500, { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' });
}
