import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { ALLOWED_ATTACHMENT_TYPES } from '@fluxo/shared';
import { env } from '../../config/env';
import { badRequest } from '../../lib/errors';
import { logger } from '../../lib/logger';

export const uploadDir = path.resolve(env.UPLOAD_DIR);
fs.mkdirSync(uploadDir, { recursive: true });

/** Caminho absoluto de um arquivo salvo, garantindo que fique dentro da pasta de uploads. */
export function storedFilePath(storedName: string): string {
  const resolved = path.resolve(uploadDir, storedName);
  if (path.dirname(resolved) !== uploadDir) throw badRequest('Nome de arquivo inválido');
  return resolved;
}

/** Corrige nomes UTF-8 que o multer entrega como latin1 e remove caracteres de controle. */
export function sanitizeFileName(original: string): string {
  const decoded = Buffer.from(original, 'latin1').toString('utf8');
  const base = path.basename(decoded.includes('�') ? original : decoded);
  const cleaned = [...base]
    .map((char) => (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? '_' : char))
    .join('')
    .replace(/[<>:"/\\|?*]+/g, '_')
    .trim();
  return (cleaned || 'arquivo').slice(0, 200);
}

export const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, callback) => {
      // O nome no disco é aleatório; a extensão vem da lista de tipos permitidos.
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${crypto.randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: env.UPLOAD_MAX_MB * 1024 * 1024, files: 1, fields: 5 },
  fileFilter: (_req, file, callback) => {
    const allowedExtensions = ALLOWED_ATTACHMENT_TYPES[file.mimetype];
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions || !allowedExtensions.includes(extension)) {
      callback(badRequest('Tipo de arquivo não permitido', 'FILE_TYPE_NOT_ALLOWED'));
      return;
    }
    callback(null, true);
  },
});

export async function deleteStoredFiles(storedNames: string[]) {
  await Promise.all(
    storedNames.map(async (name) => {
      try {
        await fs.promises.unlink(storedFilePath(name));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.warn({ error, name }, 'Falha ao remover anexo do disco');
        }
      }
    }),
  );
}
