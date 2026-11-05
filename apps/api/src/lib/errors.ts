/** Erro de negócio com status HTTP e código legível por máquina. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Array<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message: string, code = 'BAD_REQUEST') =>
  new AppError(400, code, message);

export const unauthorized = (message = 'Não autenticado', code = 'UNAUTHORIZED') =>
  new AppError(401, code, message);

export const forbidden = (message = 'Você não tem permissão para esta ação', code = 'FORBIDDEN') =>
  new AppError(403, code, message);

export const notFound = (message = 'Recurso não encontrado', code = 'NOT_FOUND') =>
  new AppError(404, code, message);

export const conflict = (message: string, code = 'CONFLICT') => new AppError(409, code, message);
