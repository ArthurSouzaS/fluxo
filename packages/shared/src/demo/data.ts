/**
 * Dados de exemplo do Fluxo.
 *
 * São usados em dois lugares:
 * - no seed do banco (apps/api/prisma/seed.ts);
 * - no modo demonstração da web (MSW), que roda sem back-end.
 *
 * Datas são relativas ao momento em que os dados são carregados
 * (dias atrás / dias a partir de hoje), para que o dashboard sempre tenha
 * cartões atrasados, a vencer e concluídos nas últimas semanas.
 */
import type { Role } from '../permissions';

export const DEMO_PASSWORD = 'fluxo123';

export interface DemoUser {
  key: string;
  name: string;
  email: string;
  username: string;
  avatarColor: string;
}

export interface DemoChecklist {
  title: string;
  items: Array<[text: string, done: boolean]>;
}

export interface DemoComment {
  author: string;
  body: string;
  daysAgo: number;
}

export interface DemoCard {
  title: string;
  description?: string;
  labels?: string[];
  assignees?: string[];
  /** Prazo em dias a partir de hoje (negativo = atrasado). */
  dueInDays?: number;
  /** Para cartões em colunas concluídas: há quantos dias foi concluído. */
  completedDaysAgo?: number;
  createdDaysAgo: number;
  createdBy: string;
  checklists?: DemoChecklist[];
  comments?: DemoComment[];
}

export interface DemoColumn {
  title: string;
  isDone?: boolean;
  wipLimit?: number;
  cards: DemoCard[];
}

export interface DemoLabel {
  key: string;
  name: string;
  color: string;
}

export interface DemoBoard {
  title: string;
  description: string;
  color: string;
  createdBy: string;
  labels: DemoLabel[];
  columns: DemoColumn[];
}

export interface DemoWorkspace {
  name: string;
  description: string;
  members: Array<{ user: string; role: Role }>;
  boards: DemoBoard[];
}

export const demoUsers: DemoUser[] = [
  {
    key: 'arthur',
    name: 'Arthur Souza Soares',
    email: 'arthur@fluxo.dev',
    username: 'arthur',
    avatarColor: '#34d399',
  },
  {
    key: 'beatriz',
    name: 'Beatriz Lima',
    email: 'beatriz@fluxo.dev',
    username: 'beatriz',
    avatarColor: '#a78bfa',
  },
  {
    key: 'carlos',
    name: 'Carlos Eduardo Ramos',
    email: 'carlos@fluxo.dev',
    username: 'carlos',
    avatarColor: '#38bdf8',
  },
  {
    key: 'diana',
    name: 'Diana Ferreira',
    email: 'diana@fluxo.dev',
    username: 'diana',
    avatarColor: '#f472b6',
  },
  {
    key: 'eduardo',
    name: 'Eduardo Nascimento',
    email: 'eduardo@fluxo.dev',
    username: 'eduardo',
    avatarColor: '#fbbf24',
  },
  {
    key: 'fernanda',
    name: 'Fernanda Oliveira',
    email: 'fernanda@fluxo.dev',
    username: 'fernanda',
    avatarColor: '#fb7185',
  },
];

const produtoLabels: DemoLabel[] = [
  { key: 'front', name: 'Front-end', color: '#38bdf8' },
  { key: 'back', name: 'Back-end', color: '#34d399' },
  { key: 'bug', name: 'Bug', color: '#f87171' },
  { key: 'ux', name: 'UX/UI', color: '#a78bfa' },
  { key: 'infra', name: 'Infra', color: '#fbbf24' },
  { key: 'urgente', name: 'Urgente', color: '#fb923c' },
];

export const demoWorkspaces: DemoWorkspace[] = [
  {
    name: 'Projeto Integrador — SENAI',
    description: 'Equipe do projeto integrador do curso técnico em Desenvolvimento de Sistemas.',
    members: [
      { user: 'arthur', role: 'OWNER' },
      { user: 'beatriz', role: 'ADMIN' },
      { user: 'carlos', role: 'MEMBER' },
      { user: 'diana', role: 'MEMBER' },
      { user: 'eduardo', role: 'OBSERVER' },
    ],
    boards: [
      {
        title: 'Sprint 12 — App Agenda Fácil',
        description:
          'Aplicativo de agendamento para salões e barbearias do bairro. Sprint focada no fluxo de reservas.',
        color: '#34d399',
        createdBy: 'arthur',
        labels: produtoLabels,
        columns: [
          {
            title: 'Backlog',
            cards: [
              {
                title: 'Exportar agenda do dia em PDF',
                description:
                  'O dono do salão quer imprimir a agenda do dia.\n\n- Gerar PDF no servidor\n- Incluir nome do cliente, serviço e horário',
                labels: ['back'],
                createdDaysAgo: 20,
                createdBy: 'beatriz',
              },
              {
                title: 'Modo escuro no aplicativo',
                labels: ['front', 'ux'],
                assignees: ['diana'],
                dueInDays: 12,
                createdDaysAgo: 15,
                createdBy: 'diana',
              },
              {
                title: 'Lembrete por WhatsApp 1h antes do horário',
                description:
                  'Pesquisar a API oficial do WhatsApp Business e o custo por mensagem antes de começar.',
                labels: ['back', 'infra'],
                createdDaysAgo: 9,
                createdBy: 'carlos',
                comments: [
                  {
                    author: 'carlos',
                    body: '@arthur vale a pena começar com e-mail e deixar o WhatsApp para a próxima sprint?',
                    daysAgo: 3,
                  },
                ],
              },
              {
                title: 'Tela de avaliação do atendimento',
                labels: ['front', 'ux'],
                createdDaysAgo: 6,
                createdBy: 'arthur',
              },
            ],
          },
          {
            title: 'A fazer',
            cards: [
              {
                title: 'Cadastro de profissionais e serviços',
                description:
                  '## Objetivo\nPermitir que o dono cadastre cada profissional com os serviços que ele realiza.\n\n## Critérios de aceite\n- [ ] Nome, foto e telefone\n- [ ] Serviços com duração e preço\n- [ ] Horário de trabalho por dia da semana',
                labels: ['back', 'front'],
                assignees: ['carlos'],
                dueInDays: 4,
                createdDaysAgo: 12,
                createdBy: 'beatriz',
                checklists: [
                  {
                    title: 'Tarefas',
                    items: [
                      ['Modelar tabelas no banco', true],
                      ['Criar rotas da API', false],
                      ['Tela de cadastro', false],
                      ['Testes de integração', false],
                    ],
                  },
                ],
              },
              {
                title: 'Corrigir fuso horário nos horários disponíveis',
                description:
                  'Clientes em outro estado veem os horários com 1h de diferença. Salvar tudo em UTC e converter só na exibição.',
                labels: ['bug', 'urgente'],
                assignees: ['arthur'],
                dueInDays: -2,
                createdDaysAgo: 8,
                createdBy: 'diana',
                comments: [
                  {
                    author: 'diana',
                    body: 'Reproduzi no celular da minha tia em Manaus. Print no grupo!',
                    daysAgo: 7,
                  },
                  {
                    author: 'arthur',
                    body: 'Valeu @diana, já sei onde está o problema: o `new Date()` no front.',
                    daysAgo: 6,
                  },
                ],
              },
              {
                title: 'Página de política de privacidade (LGPD)',
                labels: ['front'],
                assignees: ['eduardo'],
                dueInDays: 9,
                createdDaysAgo: 5,
                createdBy: 'beatriz',
              },
            ],
          },
          {
            title: 'Em andamento',
            wipLimit: 3,
            cards: [
              {
                title: 'Fluxo de reserva em 3 passos',
                description:
                  'Serviço → profissional → horário. Mostrar resumo antes de confirmar.\n\nProtótipo no Figma: **Agenda Fácil / Reserva v2**.',
                labels: ['front', 'ux'],
                assignees: ['diana', 'arthur'],
                dueInDays: 2,
                createdDaysAgo: 10,
                createdBy: 'arthur',
                checklists: [
                  {
                    title: 'Passos',
                    items: [
                      ['Escolha do serviço', true],
                      ['Escolha do profissional', true],
                      ['Calendário com horários livres', false],
                      ['Resumo e confirmação', false],
                    ],
                  },
                ],
                comments: [
                  {
                    author: 'beatriz',
                    body: 'Ficou muito bom! Só senti falta do preço total no resumo.',
                    daysAgo: 2,
                  },
                ],
              },
              {
                title: 'Autenticação com refresh token',
                description:
                  'Access token curto (15 min) + refresh token rotativo em cookie httpOnly.',
                labels: ['back'],
                assignees: ['carlos'],
                dueInDays: -1,
                createdDaysAgo: 11,
                createdBy: 'carlos',
                checklists: [
                  {
                    title: 'Checklist de segurança',
                    items: [
                      ['Hash de senha com bcrypt', true],
                      ['Rotação do refresh token', true],
                      ['Rate limit no login', false],
                    ],
                  },
                ],
              },
            ],
          },
          {
            title: 'Em revisão',
            cards: [
              {
                title: 'Listagem de horários com paginação',
                labels: ['back'],
                assignees: ['beatriz'],
                dueInDays: 1,
                createdDaysAgo: 7,
                createdBy: 'beatriz',
                comments: [
                  {
                    author: 'arthur',
                    body: '@beatriz revisei o PR, só ajustar o nome da variável `pg` para `pagina`.',
                    daysAgo: 1,
                  },
                ],
              },
            ],
          },
          {
            title: 'Concluído',
            isDone: true,
            cards: [
              {
                title: 'Configurar CI no GitHub Actions',
                labels: ['infra'],
                assignees: ['arthur'],
                completedDaysAgo: 1,
                createdDaysAgo: 30,
                createdBy: 'arthur',
              },
              {
                title: 'Docker Compose com banco e API',
                labels: ['infra'],
                assignees: ['carlos'],
                completedDaysAgo: 4,
                createdDaysAgo: 28,
                createdBy: 'carlos',
              },
              {
                title: 'Tela de login',
                labels: ['front'],
                assignees: ['diana'],
                completedDaysAgo: 6,
                createdDaysAgo: 26,
                createdBy: 'diana',
              },
              {
                title: 'Modelagem do banco de dados',
                labels: ['back'],
                assignees: ['beatriz', 'carlos'],
                completedDaysAgo: 10,
                createdDaysAgo: 35,
                createdBy: 'beatriz',
              },
              {
                title: 'Identidade visual e paleta de cores',
                labels: ['ux'],
                assignees: ['diana'],
                completedDaysAgo: 13,
                createdDaysAgo: 34,
                createdBy: 'diana',
              },
              {
                title: 'Levantamento de requisitos com o cliente',
                assignees: ['arthur', 'beatriz'],
                completedDaysAgo: 18,
                createdDaysAgo: 40,
                createdBy: 'arthur',
              },
              {
                title: 'Protótipo navegável no Figma',
                labels: ['ux'],
                assignees: ['diana'],
                completedDaysAgo: 22,
                createdDaysAgo: 38,
                createdBy: 'diana',
              },
              {
                title: 'Definir stack do projeto',
                labels: ['infra'],
                assignees: ['arthur'],
                completedDaysAgo: 27,
                createdDaysAgo: 41,
                createdBy: 'arthur',
              },
              {
                title: 'Criar repositório e padrões de commit',
                labels: ['infra'],
                assignees: ['carlos'],
                completedDaysAgo: 33,
                createdDaysAgo: 42,
                createdBy: 'carlos',
              },
            ],
          },
        ],
      },
      {
        title: 'TCC — Documentação',
        description: 'Entregas escritas do trabalho de conclusão de curso.',
        color: '#a78bfa',
        createdBy: 'beatriz',
        labels: [
          { key: 'texto', name: 'Texto', color: '#a78bfa' },
          { key: 'diagrama', name: 'Diagrama', color: '#38bdf8' },
          { key: 'revisao', name: 'Revisão', color: '#fbbf24' },
        ],
        columns: [
          {
            title: 'A escrever',
            cards: [
              {
                title: 'Capítulo 4 — Resultados',
                labels: ['texto'],
                assignees: ['beatriz'],
                dueInDays: 20,
                createdDaysAgo: 10,
                createdBy: 'beatriz',
              },
              {
                title: 'Diagrama de casos de uso',
                labels: ['diagrama'],
                assignees: ['carlos'],
                dueInDays: 6,
                createdDaysAgo: 9,
                createdBy: 'beatriz',
              },
            ],
          },
          {
            title: 'Escrevendo',
            cards: [
              {
                title: 'Capítulo 3 — Metodologia',
                description: 'Explicar Scrum adaptado: sprints de 2 semanas, daily pelo WhatsApp.',
                labels: ['texto'],
                assignees: ['arthur'],
                dueInDays: 3,
                createdDaysAgo: 14,
                createdBy: 'beatriz',
              },
            ],
          },
          {
            title: 'Com o orientador',
            cards: [
              {
                title: 'Capítulo 2 — Referencial teórico',
                labels: ['texto', 'revisao'],
                assignees: ['beatriz', 'diana'],
                dueInDays: -4,
                createdDaysAgo: 25,
                createdBy: 'beatriz',
                comments: [
                  {
                    author: 'beatriz',
                    body: 'Professor pediu mais 3 referências de 2023 para cá.',
                    daysAgo: 5,
                  },
                ],
              },
            ],
          },
          {
            title: 'Aprovado',
            isDone: true,
            cards: [
              {
                title: 'Capítulo 1 — Introdução',
                labels: ['texto'],
                assignees: ['arthur'],
                completedDaysAgo: 12,
                createdDaysAgo: 30,
                createdBy: 'beatriz',
              },
              {
                title: 'Resumo e abstract',
                labels: ['texto'],
                assignees: ['diana'],
                completedDaysAgo: 19,
                createdDaysAgo: 31,
                createdBy: 'beatriz',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Freelas',
    description: 'Projetos pessoais e trabalhos para clientes.',
    members: [
      { user: 'arthur', role: 'OWNER' },
      { user: 'fernanda', role: 'MEMBER' },
    ],
    boards: [
      {
        title: 'Site da Padaria Pão Quente',
        description: 'Site institucional com cardápio e pedidos pelo WhatsApp.',
        color: '#fbbf24',
        createdBy: 'arthur',
        labels: [
          { key: 'conteudo', name: 'Conteúdo', color: '#fbbf24' },
          { key: 'dev', name: 'Desenvolvimento', color: '#34d399' },
          { key: 'cliente', name: 'Aguardando cliente', color: '#fb7185' },
        ],
        columns: [
          {
            title: 'A fazer',
            cards: [
              {
                title: 'Fotos dos produtos',
                description: 'A dona Márcia vai mandar as fotos do pão de queijo e das tortas.',
                labels: ['conteudo', 'cliente'],
                dueInDays: 5,
                createdDaysAgo: 4,
                createdBy: 'arthur',
              },
              {
                title: 'Formulário de encomenda de bolos',
                labels: ['dev'],
                assignees: ['fernanda'],
                dueInDays: 8,
                createdDaysAgo: 3,
                createdBy: 'fernanda',
              },
            ],
          },
          {
            title: 'Fazendo',
            cards: [
              {
                title: 'Página de cardápio responsiva',
                labels: ['dev'],
                assignees: ['arthur'],
                dueInDays: 1,
                createdDaysAgo: 6,
                createdBy: 'arthur',
                checklists: [
                  {
                    title: 'Seções',
                    items: [
                      ['Pães', true],
                      ['Doces', true],
                      ['Salgados', false],
                      ['Bebidas', false],
                    ],
                  },
                ],
              },
            ],
          },
          {
            title: 'Pronto',
            isDone: true,
            cards: [
              {
                title: 'Registrar domínio',
                assignees: ['arthur'],
                completedDaysAgo: 8,
                createdDaysAgo: 12,
                createdBy: 'arthur',
              },
              {
                title: 'Layout da página inicial',
                labels: ['dev'],
                assignees: ['fernanda'],
                completedDaysAgo: 3,
                createdDaysAgo: 11,
                createdBy: 'fernanda',
              },
            ],
          },
        ],
      },
    ],
  },
];
