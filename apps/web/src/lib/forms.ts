import type { z } from 'zod';
import { ApiError } from './api/client';

export type FieldErrors = Record<string, string>;

/** Valida com um schema Zod compartilhado e devolve os erros por campo. */
export function validate<T extends z.ZodType>(
  schema: T,
  values: unknown,
): { success: true; data: z.infer<T> } | { success: false; errors: FieldErrors } {
  const result = schema.safeParse(values);
  if (result.success) return { success: true, data: result.data };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_form';
    errors[key] ??= issue.message;
  }
  return { success: false, errors };
}

/** Converte um erro da API em erros por campo + mensagem geral. */
export function apiErrors(error: unknown): FieldErrors {
  if (error instanceof ApiError) {
    const errors: FieldErrors = { _form: error.message };
    for (const detail of error.details) errors[detail.path] ??= detail.message;
    return errors;
  }
  return { _form: 'Algo deu errado. Tente novamente.' };
}

/** Só aceita caminhos internos no ?next= (evita redirecionamento aberto). */
export function safeNext(next: string | null) {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
    ? next
    : '/app';
}
