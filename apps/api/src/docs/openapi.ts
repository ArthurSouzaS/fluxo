/**
 * Documento OpenAPI 3.1 gerado a partir dos mesmos schemas Zod que validam
 * as requisições — a documentação não fica desatualizada em relação à validação.
 */
import { z } from 'zod';
import * as s from '@fluxo/shared';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

interface RouteDoc {
  method: Method;
  path: string;
  tag: string;
  summary: string;
  description?: string;
  auth?: boolean;
  body?: z.ZodType;
  multipart?: boolean;
  query?: z.ZodObject;
  success: { status: number; description: string; schema?: string };
  errors?: number[];
}

const json = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any', target: 'draft-2020-12' });

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Dados inválidos',
  401: 'Não autenticado',
  403: 'Sem permissão para a ação',
  404: 'Recurso não encontrado (ou sem acesso)',
  409: 'Conflito',
  413: 'Arquivo grande demais',
  429: 'Muitas requisições',
};

const routes: RouteDoc[] = [
  // Autenticação
  {
    method: 'post',
    path: '/auth/register',
    tag: 'Autenticação',
    auth: false,
    summary: 'Cria uma conta',
    description:
      'Cria o usuário, um workspace pessoal e inicia a sessão. O refresh token é enviado no cookie httpOnly `fluxo_refresh`.',
    body: s.registerSchema,
    success: { status: 201, description: 'Conta criada', schema: 'AuthResponse' },
    errors: [400, 409, 429],
  },
  {
    method: 'post',
    path: '/auth/login',
    tag: 'Autenticação',
    auth: false,
    summary: 'Entra com e-mail e senha',
    body: s.loginSchema,
    success: { status: 200, description: 'Sessão iniciada', schema: 'AuthResponse' },
    errors: [400, 401, 429],
  },
  {
    method: 'post',
    path: '/auth/refresh',
    tag: 'Autenticação',
    auth: false,
    summary: 'Renova o access token',
    description:
      'Usa o cookie `fluxo_refresh`. O refresh token é rotacionado a cada uso; reutilizar um token antigo encerra a sessão.',
    success: { status: 200, description: 'Novo access token', schema: 'AuthResponse' },
    errors: [401],
  },
  {
    method: 'post',
    path: '/auth/logout',
    tag: 'Autenticação',
    auth: false,
    summary: 'Encerra a sessão',
    success: { status: 204, description: 'Sessão encerrada' },
  },
  {
    method: 'post',
    path: '/auth/change-password',
    tag: 'Autenticação',
    summary: 'Troca a senha',
    description: 'Encerra todas as outras sessões e devolve um novo par de tokens.',
    body: s.changePasswordSchema,
    success: { status: 200, description: 'Senha alterada', schema: 'AuthResponse' },
    errors: [400, 401],
  },
  // Usuário
  {
    method: 'get',
    path: '/users/me',
    tag: 'Usuário',
    summary: 'Perfil do usuário logado',
    success: { status: 200, description: 'Perfil', schema: 'User' },
    errors: [401],
  },
  {
    method: 'patch',
    path: '/users/me',
    tag: 'Usuário',
    summary: 'Atualiza nome, apelido ou cor do avatar',
    body: s.updateProfileSchema,
    success: { status: 200, description: 'Perfil atualizado', schema: 'User' },
    errors: [400, 401, 409],
  },
  // Workspaces
  {
    method: 'get',
    path: '/workspaces',
    tag: 'Workspaces',
    summary: 'Lista os workspaces do usuário',
    success: { status: 200, description: 'Workspaces' },
  },
  {
    method: 'post',
    path: '/workspaces',
    tag: 'Workspaces',
    summary: 'Cria um workspace (você vira o dono)',
    body: s.createWorkspaceSchema,
    success: { status: 201, description: 'Workspace criado' },
    errors: [400],
  },
  {
    method: 'get',
    path: '/workspaces/{workspaceId}',
    tag: 'Workspaces',
    summary: 'Detalhes do workspace',
    success: { status: 200, description: 'Workspace' },
    errors: [404],
  },
  {
    method: 'patch',
    path: '/workspaces/{workspaceId}',
    tag: 'Workspaces',
    summary: 'Atualiza o workspace (dono/admin)',
    body: s.updateWorkspaceSchema,
    success: { status: 200, description: 'Atualizado' },
    errors: [400, 403, 404],
  },
  {
    method: 'delete',
    path: '/workspaces/{workspaceId}',
    tag: 'Workspaces',
    summary: 'Exclui o workspace (somente o dono)',
    success: { status: 204, description: 'Excluído' },
    errors: [403, 404],
  },
  {
    method: 'get',
    path: '/workspaces/{workspaceId}/members',
    tag: 'Membros',
    summary: 'Lista os membros',
    success: { status: 200, description: 'Membros' },
    errors: [404],
  },
  {
    method: 'post',
    path: '/workspaces/{workspaceId}/members',
    tag: 'Membros',
    summary: 'Adiciona um usuário cadastrado pelo e-mail',
    body: s.addMemberSchema,
    success: { status: 201, description: 'Membro adicionado' },
    errors: [400, 403, 404, 409],
  },
  {
    method: 'patch',
    path: '/workspaces/{workspaceId}/members/{userId}',
    tag: 'Membros',
    summary: 'Altera o papel (OWNER transfere a propriedade)',
    body: s.updateMemberSchema,
    success: { status: 200, description: 'Papel alterado' },
    errors: [400, 403, 404],
  },
  {
    method: 'delete',
    path: '/workspaces/{workspaceId}/members/{userId}',
    tag: 'Membros',
    summary: 'Remove um membro (ou sai do workspace)',
    success: { status: 204, description: 'Removido' },
    errors: [400, 403, 404],
  },
  // Quadros
  {
    method: 'get',
    path: '/workspaces/{workspaceId}/boards',
    tag: 'Quadros',
    summary: 'Lista os quadros do workspace',
    query: z.object({ archived: z.enum(['true', 'false']).optional() }),
    success: { status: 200, description: 'Quadros' },
    errors: [404],
  },
  {
    method: 'post',
    path: '/workspaces/{workspaceId}/boards',
    tag: 'Quadros',
    summary: 'Cria um quadro a partir de um modelo',
    body: s.createBoardSchema,
    success: { status: 201, description: 'Quadro criado' },
    errors: [400, 403, 404],
  },
  {
    method: 'get',
    path: '/boards/{boardId}',
    tag: 'Quadros',
    summary: 'Quadro completo: colunas, cartões, etiquetas e membros',
    success: { status: 200, description: 'Quadro' },
    errors: [404],
  },
  {
    method: 'patch',
    path: '/boards/{boardId}',
    tag: 'Quadros',
    summary: 'Atualiza ou arquiva o quadro',
    body: s.updateBoardSchema,
    success: { status: 200, description: 'Atualizado' },
    errors: [400, 403, 404],
  },
  {
    method: 'delete',
    path: '/boards/{boardId}',
    tag: 'Quadros',
    summary: 'Exclui o quadro (dono/admin)',
    success: { status: 204, description: 'Excluído' },
    errors: [403, 404],
  },
  {
    method: 'get',
    path: '/boards/{boardId}/stats',
    tag: 'Quadros',
    summary: 'Estatísticas para o dashboard',
    success: { status: 200, description: 'Estatísticas' },
    errors: [404],
  },
  {
    method: 'get',
    path: '/boards/{boardId}/activities',
    tag: 'Histórico',
    summary: 'Histórico do quadro (paginado)',
    query: s.paginationQuerySchema,
    success: { status: 200, description: 'Atividades' },
    errors: [404],
  },
  // Colunas
  {
    method: 'post',
    path: '/boards/{boardId}/columns',
    tag: 'Colunas',
    summary: 'Cria uma coluna no fim do quadro',
    body: s.createColumnSchema,
    success: { status: 201, description: 'Coluna criada' },
    errors: [400, 403, 404],
  },
  {
    method: 'patch',
    path: '/columns/{columnId}',
    tag: 'Colunas',
    summary: 'Renomeia, define limite WIP ou marca como concluída',
    body: s.updateColumnSchema,
    success: { status: 200, description: 'Atualizada' },
    errors: [400, 403, 404],
  },
  {
    method: 'post',
    path: '/columns/{columnId}/move',
    tag: 'Colunas',
    summary: 'Reordena a coluna',
    body: s.moveColumnSchema,
    success: { status: 200, description: 'Movida' },
    errors: [400, 403, 404],
  },
  {
    method: 'delete',
    path: '/columns/{columnId}',
    tag: 'Colunas',
    summary: 'Exclui a coluna e os cartões dela',
    success: { status: 204, description: 'Excluída' },
    errors: [403, 404],
  },
  // Cartões
  {
    method: 'get',
    path: '/boards/{boardId}/cards',
    tag: 'Cartões',
    summary: 'Lista cartões com busca, filtros e paginação',
    query: s.cardFiltersSchema,
    success: { status: 200, description: 'Cartões paginados' },
    errors: [400, 404],
  },
  {
    method: 'post',
    path: '/columns/{columnId}/cards',
    tag: 'Cartões',
    summary: 'Cria um cartão no fim da coluna',
    body: s.createCardSchema,
    success: { status: 201, description: 'Cartão criado' },
    errors: [400, 403, 404],
  },
  {
    method: 'get',
    path: '/cards/{cardId}',
    tag: 'Cartões',
    summary: 'Detalhes do cartão',
    success: { status: 200, description: 'Cartão' },
    errors: [404],
  },
  {
    method: 'patch',
    path: '/cards/{cardId}',
    tag: 'Cartões',
    summary: 'Atualiza título, descrição, prazo ou arquiva',
    body: s.updateCardSchema,
    success: { status: 200, description: 'Atualizado' },
    errors: [400, 403, 404],
  },
  {
    method: 'post',
    path: '/cards/{cardId}/move',
    tag: 'Cartões',
    summary: 'Move o cartão para uma coluna/posição',
    body: s.moveCardSchema,
    success: { status: 200, description: 'Movido' },
    errors: [400, 403, 404],
  },
  {
    method: 'put',
    path: '/cards/{cardId}/assignees',
    tag: 'Cartões',
    summary: 'Define os responsáveis',
    body: s.setAssigneesSchema,
    success: { status: 200, description: 'Responsáveis definidos' },
    errors: [400, 403, 404],
  },
  {
    method: 'put',
    path: '/cards/{cardId}/labels',
    tag: 'Cartões',
    summary: 'Define as etiquetas',
    body: s.setLabelsSchema,
    success: { status: 200, description: 'Etiquetas definidas' },
    errors: [400, 403, 404],
  },
  {
    method: 'delete',
    path: '/cards/{cardId}',
    tag: 'Cartões',
    summary: 'Exclui o cartão',
    success: { status: 204, description: 'Excluído' },
    errors: [403, 404],
  },
  {
    method: 'get',
    path: '/cards/{cardId}/activities',
    tag: 'Histórico',
    summary: 'Histórico do cartão (paginado)',
    query: s.paginationQuerySchema,
    success: { status: 200, description: 'Atividades' },
    errors: [404],
  },
  // Etiquetas
  {
    method: 'get',
    path: '/boards/{boardId}/labels',
    tag: 'Etiquetas',
    summary: 'Lista as etiquetas do quadro',
    success: { status: 200, description: 'Etiquetas' },
    errors: [404],
  },
  {
    method: 'post',
    path: '/boards/{boardId}/labels',
    tag: 'Etiquetas',
    summary: 'Cria uma etiqueta',
    body: s.createLabelSchema,
    success: { status: 201, description: 'Criada' },
    errors: [400, 403, 404],
  },
  {
    method: 'patch',
    path: '/labels/{labelId}',
    tag: 'Etiquetas',
    summary: 'Atualiza uma etiqueta',
    body: s.updateLabelSchema,
    success: { status: 200, description: 'Atualizada' },
    errors: [400, 403, 404],
  },
  {
    method: 'delete',
    path: '/labels/{labelId}',
    tag: 'Etiquetas',
    summary: 'Exclui uma etiqueta',
    success: { status: 204, description: 'Excluída' },
    errors: [403, 404],
  },
  // Checklists
  {
    method: 'post',
    path: '/cards/{cardId}/checklists',
    tag: 'Checklists',
    summary: 'Adiciona um checklist ao cartão',
    body: s.createChecklistSchema,
    success: { status: 201, description: 'Criado' },
    errors: [400, 403, 404],
  },
  {
    method: 'patch',
    path: '/checklists/{checklistId}',
    tag: 'Checklists',
    summary: 'Renomeia o checklist',
    body: s.updateChecklistSchema,
    success: { status: 200, description: 'Atualizado' },
    errors: [400, 403, 404],
  },
  {
    method: 'delete',
    path: '/checklists/{checklistId}',
    tag: 'Checklists',
    summary: 'Exclui o checklist',
    success: { status: 204, description: 'Excluído' },
    errors: [403, 404],
  },
  {
    method: 'post',
    path: '/checklists/{checklistId}/items',
    tag: 'Checklists',
    summary: 'Adiciona um item',
    body: s.createChecklistItemSchema,
    success: { status: 201, description: 'Checklist atualizado' },
    errors: [400, 403, 404],
  },
  {
    method: 'patch',
    path: '/checklist-items/{itemId}',
    tag: 'Checklists',
    summary: 'Edita ou marca um item',
    body: s.updateChecklistItemSchema,
    success: { status: 200, description: 'Checklist atualizado' },
    errors: [400, 403, 404],
  },
  {
    method: 'delete',
    path: '/checklist-items/{itemId}',
    tag: 'Checklists',
    summary: 'Remove um item',
    success: { status: 200, description: 'Checklist atualizado' },
    errors: [403, 404],
  },
  // Comentários
  {
    method: 'get',
    path: '/cards/{cardId}/comments',
    tag: 'Comentários',
    summary: 'Lista comentários (mais recentes primeiro)',
    query: s.paginationQuerySchema,
    success: { status: 200, description: 'Comentários' },
    errors: [404],
  },
  {
    method: 'post',
    path: '/cards/{cardId}/comments',
    tag: 'Comentários',
    summary: 'Comenta no cartão (menções com @apelido geram notificações)',
    body: s.commentBodySchema,
    success: { status: 201, description: 'Comentário criado' },
    errors: [400, 403, 404],
  },
  {
    method: 'patch',
    path: '/comments/{commentId}',
    tag: 'Comentários',
    summary: 'Edita o próprio comentário',
    body: s.commentBodySchema,
    success: { status: 200, description: 'Editado' },
    errors: [400, 403, 404],
  },
  {
    method: 'delete',
    path: '/comments/{commentId}',
    tag: 'Comentários',
    summary: 'Exclui comentário (autor ou dono/admin)',
    success: { status: 204, description: 'Excluído' },
    errors: [403, 404],
  },
  // Anexos
  {
    method: 'post',
    path: '/cards/{cardId}/attachments',
    tag: 'Anexos',
    summary: 'Envia um anexo (multipart, campo "file")',
    multipart: true,
    success: { status: 201, description: 'Anexo salvo' },
    errors: [400, 403, 404, 413, 429],
  },
  {
    method: 'get',
    path: '/attachments/{attachmentId}/download',
    tag: 'Anexos',
    summary: 'Baixa o arquivo',
    success: { status: 200, description: 'Arquivo' },
    errors: [404],
  },
  {
    method: 'delete',
    path: '/attachments/{attachmentId}',
    tag: 'Anexos',
    summary: 'Remove o anexo (quem enviou ou dono/admin)',
    success: { status: 204, description: 'Removido' },
    errors: [403, 404],
  },
  // Notificações e busca
  {
    method: 'get',
    path: '/notifications',
    tag: 'Notificações',
    summary: 'Lista notificações e total de não lidas',
    query: s.notificationsQuerySchema,
    success: { status: 200, description: 'Notificações' },
  },
  {
    method: 'post',
    path: '/notifications/{notificationId}/read',
    tag: 'Notificações',
    summary: 'Marca como lida',
    success: { status: 200, description: 'Notificação' },
    errors: [404],
  },
  {
    method: 'post',
    path: '/notifications/read-all',
    tag: 'Notificações',
    summary: 'Marca todas como lidas',
    success: { status: 200, description: 'Quantidade atualizada' },
  },
  {
    method: 'get',
    path: '/search',
    tag: 'Busca',
    summary: 'Busca global em quadros e cartões',
    query: s.searchQuerySchema,
    success: { status: 200, description: 'Resultados' },
    errors: [400],
  },
];

function queryParameters(schema: z.ZodObject) {
  const jsonSchema = json(schema) as { properties?: Record<string, object>; required?: string[] };
  return Object.entries(jsonSchema.properties ?? {}).map(([name, property]) => ({
    name,
    in: 'query',
    required: jsonSchema.required?.includes(name) ?? false,
    schema: property,
  }));
}

function pathParameters(path: string) {
  return [...path.matchAll(/\{(\w+)\}/g)].map((match) => ({
    name: match[1],
    in: 'path',
    required: true,
    schema: { type: 'string' },
  }));
}

export function buildOpenApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    const responses: Record<string, unknown> = {
      [route.success.status]: {
        description: route.success.description,
        ...(route.success.schema
          ? { content: { 'application/json': { schema: ref(route.success.schema) } } }
          : {}),
      },
    };
    const errors = new Set([...(route.errors ?? []), ...(route.auth === false ? [] : [401])]);
    for (const status of [...errors].sort()) {
      responses[status] = {
        description: ERROR_DESCRIPTIONS[status] ?? 'Erro',
        content: { 'application/json': { schema: ref('Error') } },
      };
    }

    const operation: Record<string, unknown> = {
      tags: [route.tag],
      summary: route.summary,
      ...(route.description ? { description: route.description } : {}),
      ...(route.auth === false ? { security: [] } : {}),
      parameters: [
        ...pathParameters(route.path),
        ...(route.query ? queryParameters(route.query) : []),
      ],
      responses,
    };
    if (route.body) {
      operation.requestBody = {
        required: true,
        content: { 'application/json': { schema: json(route.body) } },
      };
    }
    if (route.multipart) {
      operation.requestBody = {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              required: ['file'],
              properties: { file: { type: 'string', format: 'binary' } },
            },
          },
        },
      };
    }

    paths[route.path] ??= {};
    paths[route.path]![route.method] = operation;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Fluxo API',
      version: '1.0.0',
      description:
        'API REST do Fluxo, gerenciador de projetos colaborativo em tempo real.\n\n' +
        '1. Entre em **POST /auth/login** (usuário de exemplo: `arthur@fluxo.dev` / `fluxo123`).\n' +
        '2. Copie o `accessToken` da resposta e clique em **Authorize**.\n\n' +
        'Eventos em tempo real são enviados via Socket.io no mesmo endereço da API.',
    },
    servers: [{ url: '/api' }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', examples: ['VALIDATION_ERROR'] },
                message: { type: 'string', examples: ['E-mail inválido'] },
                details: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: { path: { type: 'string' }, message: { type: 'string' } },
                  },
                },
              },
            },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            username: { type: 'string' },
            email: { type: 'string' },
            avatarColor: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: { user: ref('User'), accessToken: { type: 'string' } },
        },
      },
    },
    paths,
  };
}
