/**
 * Schemas Zod de entrada da API. A API valida com eles e a web reutiliza
 * nos formulários — a mesma regra nos dois lados.
 */
import { z } from 'zod';
import { ROLES } from './permissions';

// ---------------------------------------------------------------------------
// Básicos
// ---------------------------------------------------------------------------

export const idSchema = z.string().trim().min(1, 'Identificador obrigatório').max(64);

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida (use o formato #RRGGBB)');

export const emailSchema = z
  .string({ error: 'Informe o e-mail' })
  .trim()
  .toLowerCase()
  .max(254, 'E-mail muito longo')
  .pipe(z.email('E-mail inválido'));

/** bcrypt considera só os primeiros 72 bytes, por isso o limite. */
export const passwordSchema = z
  .string({ error: 'Informe a senha' })
  .min(8, 'A senha deve ter pelo menos 8 caracteres')
  .max(72, 'A senha deve ter no máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'A senha deve conter pelo menos uma letra')
  .regex(/\d/, 'A senha deve conter pelo menos um número');

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9](?:[a-z0-9._-]{1,22}[a-z0-9])$/,
    'Use de 3 a 24 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado',
  );

const isoDateTime = z.iso.datetime({ offset: true, error: 'Data inválida' });

const optionalText = (max: number, message: string) =>
  z.string().trim().max(max, message).optional();

// ---------------------------------------------------------------------------
// Paginação e consultas
// ---------------------------------------------------------------------------

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

/** Aceita "a,b,c" e devolve ["a","b","c"]. */
const csvIds = z
  .string()
  .max(2000)
  .transform((value) =>
    value
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )
  .pipe(z.array(idSchema).max(50));

export const DUE_FILTERS = ['overdue', 'today', 'week', 'none'] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];

export const cardFiltersSchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
  labelIds: csvIds.optional(),
  assigneeIds: csvIds.optional(),
  due: z.enum(DUE_FILTERS).optional(),
  status: z.enum(['open', 'done']).optional(),
  archived: booleanQuery.optional(),
  sort: z.enum(['position', 'dueDate', 'createdAt', 'updatedAt']).default('position'),
});
export type CardFilters = z.infer<typeof cardFiltersSchema>;

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2, 'Digite pelo menos 2 caracteres').max(100),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

export const notificationsQuerySchema = paginationQuerySchema.extend({
  unread: booleanQuery.optional(),
});

// ---------------------------------------------------------------------------
// Autenticação e perfil
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  name: z
    .string({ error: 'Informe o nome' })
    .trim()
    .min(2, 'O nome deve ter pelo menos 2 caracteres')
    .max(80, 'O nome deve ter no máximo 80 caracteres'),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'Informe a senha' }).min(1, 'Informe a senha').max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual').max(72),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: 'A nova senha deve ser diferente da atual',
    path: ['newPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, 'O nome deve ter pelo menos 2 caracteres').max(80),
    username: usernameSchema,
    avatarColor: hexColorSchema,
  })
  .partial();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ---------------------------------------------------------------------------
// Workspaces e membros
// ---------------------------------------------------------------------------

export const createWorkspaceSchema = z.object({
  name: z
    .string({ error: 'Informe o nome' })
    .trim()
    .min(2, 'O nome deve ter pelo menos 2 caracteres')
    .max(60, 'O nome deve ter no máximo 60 caracteres'),
  description: optionalText(280, 'A descrição deve ter no máximo 280 caracteres'),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = createWorkspaceSchema.partial();
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const INVITABLE_ROLES = ['ADMIN', 'MEMBER', 'OBSERVER'] as const;

export const addMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(INVITABLE_ROLES).default('MEMBER'),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberSchema = z.object({
  /** OWNER = transferir a propriedade do workspace. */
  role: z.enum(ROLES),
});
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

// ---------------------------------------------------------------------------
// Quadros e colunas
// ---------------------------------------------------------------------------

export const BOARD_TEMPLATES = ['kanban', 'scrum', 'blank'] as const;
export type BoardTemplate = (typeof BOARD_TEMPLATES)[number];

export const createBoardSchema = z.object({
  title: z
    .string({ error: 'Informe o título' })
    .trim()
    .min(1, 'Informe o título')
    .max(80, 'O título deve ter no máximo 80 caracteres'),
  description: optionalText(500, 'A descrição deve ter no máximo 500 caracteres'),
  color: hexColorSchema.optional(),
  template: z.enum(BOARD_TEMPLATES).default('kanban'),
});
export type CreateBoardInput = z.input<typeof createBoardSchema>;

export const updateBoardSchema = z
  .object({
    title: z.string().trim().min(1, 'Informe o título').max(80),
    description: z.string().trim().max(500),
    color: hexColorSchema,
    archived: z.boolean(),
  })
  .partial();
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;

export const createColumnSchema = z.object({
  title: z
    .string({ error: 'Informe o título' })
    .trim()
    .min(1, 'Informe o título')
    .max(60, 'O título deve ter no máximo 60 caracteres'),
  wipLimit: z.number().int().min(1).max(99).nullable().optional(),
  isDone: z.boolean().optional(),
});
export type CreateColumnInput = z.infer<typeof createColumnSchema>;

export const updateColumnSchema = createColumnSchema.partial();
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>;

export const moveColumnSchema = z.object({
  index: z.number().int().min(0),
});
export type MoveColumnInput = z.infer<typeof moveColumnSchema>;

// ---------------------------------------------------------------------------
// Cartões
// ---------------------------------------------------------------------------

const cardTitle = z
  .string({ error: 'Informe o título' })
  .trim()
  .min(1, 'Informe o título')
  .max(200, 'O título deve ter no máximo 200 caracteres');
const cardDescription = z.string().max(20000, 'A descrição deve ter no máximo 20.000 caracteres');

export const createCardSchema = z.object({
  title: cardTitle,
  description: cardDescription.optional(),
  dueDate: isoDateTime.nullable().optional(),
  assigneeIds: z.array(idSchema).max(20).optional(),
  labelIds: z.array(idSchema).max(30).optional(),
});
export type CreateCardInput = z.infer<typeof createCardSchema>;

export const updateCardSchema = z
  .object({
    title: cardTitle,
    description: cardDescription,
    dueDate: isoDateTime.nullable(),
    archived: z.boolean(),
  })
  .partial();
export type UpdateCardInput = z.infer<typeof updateCardSchema>;

export const moveCardSchema = z.object({
  columnId: idSchema,
  index: z.number().int().min(0),
});
export type MoveCardInput = z.infer<typeof moveCardSchema>;

export const setAssigneesSchema = z.object({
  userIds: z.array(idSchema).max(20),
});
export type SetAssigneesInput = z.infer<typeof setAssigneesSchema>;

export const setLabelsSchema = z.object({
  labelIds: z.array(idSchema).max(30),
});
export type SetLabelsInput = z.infer<typeof setLabelsSchema>;

// ---------------------------------------------------------------------------
// Etiquetas, checklists e comentários
// ---------------------------------------------------------------------------

export const createLabelSchema = z.object({
  name: z
    .string({ error: 'Informe o nome' })
    .trim()
    .min(1, 'Informe o nome')
    .max(30, 'O nome deve ter no máximo 30 caracteres'),
  color: hexColorSchema,
});
export type CreateLabelInput = z.infer<typeof createLabelSchema>;

export const updateLabelSchema = createLabelSchema.partial();
export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;

export const createChecklistSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título').max(100),
});
export type CreateChecklistInput = z.infer<typeof createChecklistSchema>;

export const updateChecklistSchema = createChecklistSchema;
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>;

export const createChecklistItemSchema = z.object({
  text: z.string().trim().min(1, 'Informe o texto').max(300),
});
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>;

export const updateChecklistItemSchema = z
  .object({
    text: z.string().trim().min(1, 'Informe o texto').max(300),
    done: z.boolean(),
  })
  .partial();
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>;

export const commentBodySchema = z.object({
  body: z
    .string({ error: 'Escreva um comentário' })
    .trim()
    .min(1, 'Escreva um comentário')
    .max(5000, 'O comentário deve ter no máximo 5.000 caracteres'),
});
export type CommentBodyInput = z.infer<typeof commentBodySchema>;

// ---------------------------------------------------------------------------
// Anexos
// ---------------------------------------------------------------------------

/** Tipos de arquivo aceitos como anexo. */
export const ALLOWED_ATTACHMENT_TYPES: Record<string, string[]> = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt', '.md', '.log'],
  'text/csv': ['.csv'],
  'application/zip': ['.zip'],
  'application/json': ['.json'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
};
