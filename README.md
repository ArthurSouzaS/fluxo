# Fluxo

[![CI](https://github.com/ArthurSouzaS/fluxo/actions/workflows/ci.yml/badge.svg)](https://github.com/ArthurSouzaS/fluxo/actions/workflows/ci.yml)
[![Demo](https://github.com/ArthurSouzaS/fluxo/actions/workflows/pages.yml/badge.svg)](https://arthursouzas.github.io/fluxo)

**Gerenciador de projetos colaborativo em tempo real**, no estilo Trello/Jira: workspaces com papéis, quadros kanban com arrastar e soltar, cartões completos (markdown, checklists, anexos, comentários com @menção), notificações, busca global e dashboard — tudo atualizando ao vivo para a equipe inteira.

🔗 **Demonstração online:** <https://arthursouzas.github.io/fluxo> — roda 100% no navegador, sem servidor (entre com `arthur@fluxo.dev` / `fluxo123`, já preenchidos).

> Projeto de portfólio de **Arthur Souza Soares**, estudante do curso técnico em Desenvolvimento de Sistemas no SENAI.

![Quadro kanban no tema escuro](docs/screenshots/quadro-escuro.png)

## Sumário

- [Funcionalidades](#funcionalidades)
- [Prints](#prints)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Modelo do banco de dados](#modelo-do-banco-de-dados)
- [Como rodar com Docker](#como-rodar-com-docker)
- [Como rodar sem Docker](#como-rodar-sem-docker)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Testes](#testes)
- [Segurança](#segurança)
- [Acessibilidade e atalhos](#acessibilidade-e-atalhos)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Decisões e plano](#decisões-e-plano)

## Funcionalidades

**Colaboração**

- Workspaces com quatro papéis: **dono**, **administrador**, **membro** e **observador** (somente leitura). As permissões são as mesmas na API e na interface.
- Convite de membros por e-mail, troca de papel, transferência de propriedade e saída do workspace.
- **Tempo real com Socket.io**: mover, criar, editar e comentar aparece na hora para quem está no quadro, com indicador de **quem está online**.
- **Notificações em tempo real** para menções (`@apelido`), atribuições e comentários nos cartões em que você é responsável.

**Quadros e cartões**

- Quadros a partir de modelos (Kanban, Sprint ou em branco), com cor, descrição e arquivamento.
- Colunas reordenáveis, com limite WIP e marcação de "coluna de concluídos".
- **Arrastar e soltar** de colunas e cartões com dnd-kit — por mouse, toque **e teclado** — e **atualização otimista** (a tela muda na hora; se a API recusar, volta ao estado anterior).
- Cartão completo: descrição em **Markdown** (com pré-visualização), etiquetas, responsáveis, prazo, **checklists com barra de progresso**, **anexos** (com miniatura de imagens), **comentários com autocompletar de @menção** e **histórico de atividades**.
- Filtros no quadro (texto, etiquetas, responsáveis, prazo, "meus cartões") e **busca global com Ctrl+K**.

**Dashboard por quadro**

- Indicadores (em aberto, concluídos, atrasados, vencem em 7 dias) e gráficos **SVG feitos à mão**: cartões por status, por responsável e por etiqueta, e concluídos por semana. Cada gráfico tem dica ao passar o mouse e alternativa em tabela.

**Experiência**

- Tema **escuro e claro** (paleta: fundo `#0b0d12`, verde `#34d399`, azul `#38bdf8`, roxo `#a78bfa`; fontes Inter e JetBrains Mono), responsivo, acessível e com atalhos de teclado.
- Estados de carregamento (skeletons), vazio e erro em todas as telas.

## Prints

| Workspaces                                                        | Cartão                                          |
| ----------------------------------------------------------------- | ----------------------------------------------- |
| ![Lista de workspaces e quadros](docs/screenshots/workspaces.png) | ![Modal do cartão](docs/screenshots/cartao.png) |
| **Dashboard**                                                     | **Busca global (Ctrl+K)**                       |
| ![Dashboard do quadro](docs/screenshots/dashboard.png)            | ![Busca global](docs/screenshots/busca.png)     |
| **Tema claro**                                                    | **Login**                                       |
| ![Quadro no tema claro](docs/screenshots/quadro-claro.png)        | ![Tela de login](docs/screenshots/login.png)    |

<p align="center"><img src="docs/screenshots/celular.png" alt="Quadro no celular" width="280"></p>

## Tecnologias

| Camada                                | Tecnologias                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Monorepo**                          | pnpm workspaces, TypeScript, ESLint (flat config + jsx-a11y), Prettier                                                                      |
| **API** (`apps/api`)                  | Node.js, Express 5, Prisma 6, PostgreSQL 16, Socket.io, Zod, JWT (access + refresh), bcrypt, Multer, Helmet, express-rate-limit, Swagger UI |
| **Web** (`apps/web`)                  | Next.js 15 (App Router), React 19, TanStack Query, dnd-kit, SCSS Modules, react-markdown, socket.io-client                                  |
| **Compartilhado** (`packages/shared`) | Schemas Zod, tipos das respostas, regras de permissão, ordenação, menções e estatísticas                                                    |
| **Testes**                            | Vitest, Supertest, Testing Library, Playwright                                                                                              |
| **Infra**                             | Docker Compose, GitHub Actions (CI + GitHub Pages), MSW (modo demonstração)                                                                 |

## Arquitetura

```mermaid
flowchart LR
  subgraph Navegador
    UI["Next.js + React<br/>TanStack Query · dnd-kit"]
    SIO_C["socket.io-client"]
    MSW["MSW (só no modo demonstração)"]
  end

  subgraph API["apps/api — Express"]
    MW["Helmet · CORS · rate limit<br/>JWT · validação Zod"]
    ROUTES["Rotas REST"]
    SVC["Services<br/>(regras e permissões)"]
    BUS["realtimeBus"]
    SIO_S["Socket.io<br/>salas board:id e user:id"]
    DOCS["Swagger /docs"]
  end

  SHARED[["packages/shared<br/>schemas · tipos · permissões"]]
  DB[(PostgreSQL)]
  FS[(uploads/)]

  UI -- "HTTP + Bearer token" --> MW --> ROUTES --> SVC
  SVC -- Prisma --> DB
  SVC --> FS
  SVC -- "publica eventos" --> BUS --> SIO_S
  SIO_S -- "board:event · presence · notification" --> SIO_C --> UI
  UI -. "demonstração" .-> MSW
  SHARED -.-> UI
  SHARED -.-> SVC
  SHARED -.-> MSW
```

**Como uma alteração chega a todos em tempo real:**

```mermaid
sequenceDiagram
  participant A as Navegador da Ana
  participant API as API (Express)
  participant DB as PostgreSQL
  participant IO as Socket.io
  participant B as Navegador do Bruno

  A->>A: arrasta o cartão (atualização otimista)
  A->>API: POST /cards/:id/move (x-socket-id)
  API->>API: valida token, papel e dados (Zod)
  API->>DB: atualiza posição/coluna + registra atividade
  API-->>A: 200 com o cartão atualizado
  API->>IO: card.moved para a sala board:id (exceto o socket da Ana)
  IO-->>B: board:event
  B->>B: aplica o evento no cache e o cartão se move na tela
```

Pontos principais:

- **Um contrato só**: os schemas Zod do pacote `shared` validam as requisições na API, os formulários na web e geram a documentação Swagger.
- **Services desacoplados do Socket.io**: publicam no `realtimeBus`; o módulo de tempo real repassa para as salas.
- **Autenticação**: access token JWT de 15 min só em memória + refresh token opaco em cookie `httpOnly`, rotacionado a cada uso, com detecção de reuso.
- **Ordenação barata**: posições em ponto flutuante (ponto médio entre vizinhos), com renumeração automática quando necessário.

## Modelo do banco de dados

```mermaid
erDiagram
  USER ||--o{ WORKSPACE_MEMBER : participa
  WORKSPACE ||--o{ WORKSPACE_MEMBER : tem
  WORKSPACE ||--o{ BOARD : contem
  BOARD ||--o{ BOARD_COLUMN : tem
  BOARD ||--o{ CARD : tem
  BOARD ||--o{ LABEL : tem
  BOARD_COLUMN ||--o{ CARD : agrupa
  CARD ||--o{ CARD_ASSIGNEE : tem
  USER ||--o{ CARD_ASSIGNEE : responsavel
  CARD ||--o{ CARD_LABEL : tem
  LABEL ||--o{ CARD_LABEL : marca
  CARD ||--o{ CHECKLIST : tem
  CHECKLIST ||--o{ CHECKLIST_ITEM : tem
  CARD ||--o{ COMMENT : tem
  USER ||--o{ COMMENT : escreve
  CARD ||--o{ ATTACHMENT : tem
  WORKSPACE ||--o{ ACTIVITY : registra
  USER ||--o{ NOTIFICATION : recebe
  USER ||--o{ REFRESH_TOKEN : possui

  USER {
    string id PK
    string name
    string email UK
    string username UK
    string passwordHash
    string avatarColor
  }
  WORKSPACE {
    string id PK
    string name
    string description
  }
  WORKSPACE_MEMBER {
    string workspaceId FK
    string userId FK
    enum role "OWNER ADMIN MEMBER OBSERVER"
  }
  BOARD {
    string id PK
    string workspaceId FK
    string title
    string color
    boolean archived
  }
  BOARD_COLUMN {
    string id PK
    string boardId FK
    string title
    float position
    int wipLimit
    boolean isDone
  }
  CARD {
    string id PK
    string columnId FK
    string title
    string description "markdown"
    float position
    datetime dueDate
    datetime completedAt
    boolean archived
  }
  LABEL {
    string id PK
    string boardId FK
    string name
    string color
  }
  CHECKLIST {
    string id PK
    string cardId FK
    string title
  }
  CHECKLIST_ITEM {
    string id PK
    string checklistId FK
    string text
    boolean done
  }
  COMMENT {
    string id PK
    string cardId FK
    string authorId FK
    string body
  }
  ATTACHMENT {
    string id PK
    string cardId FK
    string fileName
    string storedName UK
    string mimeType
    int size
  }
  ACTIVITY {
    string id PK
    string boardId FK
    string cardId FK
    string actorId FK
    string type
    json data
  }
  NOTIFICATION {
    string id PK
    string userId FK
    enum type "MENTION ASSIGNED COMMENT MEMBER_ADDED"
    string message
    datetime readAt
  }
  REFRESH_TOKEN {
    string id PK
    string tokenHash UK
    string family
    datetime expiresAt
    datetime revokedAt
  }
```

O schema completo está em [`apps/api/prisma/schema.prisma`](apps/api/prisma/schema.prisma).

## Como rodar com Docker

Pré-requisito: Docker com Docker Compose.

```bash
docker compose up --build
```

Pronto:

- Web: <http://localhost:3000>
- API: <http://localhost:3333> · documentação Swagger em <http://localhost:3333/docs>
- PostgreSQL: `localhost:5432` (usuário/senha `postgres`)

Na primeira subida, a API aplica as migrations e popula o banco com dados de exemplo. Entre com **`arthur@fluxo.dev` / `fluxo123`** (outros usuários: `beatriz@`, `carlos@`, `diana@`, `eduardo@` e `fernanda@fluxo.dev`, todos com a mesma senha).

> Para produção, defina `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET` (o `docker-compose.yml` lê do ambiente) e sirva por HTTPS com `COOKIE_SECURE=true`.

## Como rodar sem Docker

Pré-requisitos: **Node.js 20+** (recomendado 22), **pnpm** (via `corepack enable`) e **PostgreSQL 14+**.

```bash
corepack enable
```

```bash
pnpm install
```

```bash
cp apps/api/.env.example apps/api/.env
```

Ajuste `DATABASE_URL` no `apps/api/.env` se necessário e crie o banco:

```bash
pnpm db:migrate
```

```bash
pnpm db:seed
```

Suba API e web juntas (com recarregamento automático):

```bash
pnpm dev
```

A web abre em <http://localhost:3000> e a API em <http://localhost:3333>.

### Modo demonstração local

Gera o site estático com a API simulada pelo MSW (o mesmo publicado no GitHub Pages):

```bash
pnpm build:demo
```

O resultado fica em `apps/web/out`; sirva a pasta `out` como `/fluxo` em qualquer servidor estático.

## Variáveis de ambiente

### API (`apps/api/.env`)

| Variável                | Padrão                       | Descrição                                                                    |
| ----------------------- | ---------------------------- | ---------------------------------------------------------------------------- |
| `NODE_ENV`              | `development`                | `development`, `test` ou `production`                                        |
| `PORT`                  | `3333`                       | Porta HTTP da API e do Socket.io                                             |
| `DATABASE_URL`          | —                            | URL de conexão do PostgreSQL (**obrigatória**)                               |
| `JWT_ACCESS_SECRET`     | —                            | Segredo do access token, mínimo 32 caracteres (**obrigatória**)              |
| `JWT_REFRESH_SECRET`    | —                            | Segredo do HMAC dos refresh tokens, mínimo 32 caracteres (**obrigatória**)   |
| `JWT_ACCESS_EXPIRES_IN` | `15m`                        | Validade do access token                                                     |
| `REFRESH_TOKEN_DAYS`    | `7`                          | Validade do refresh token, em dias                                           |
| `CORS_ORIGIN`           | `http://localhost:3000`      | Origens permitidas (separadas por vírgula)                                   |
| `UPLOAD_DIR`            | `./uploads`                  | Pasta dos anexos                                                             |
| `UPLOAD_MAX_MB`         | `10`                         | Tamanho máximo de um anexo                                                   |
| `TRUST_PROXY`           | `0`                          | Quantidade de proxies reversos confiáveis (para o rate limit usar o IP real) |
| `COOKIE_SECURE`         | `false`                      | `true` atrás de HTTPS (cookie `Secure`, HSTS)                                |
| `RATE_LIMIT_ENABLED`    | ligado (desligado em `test`) | Liga/desliga o rate limit                                                    |
| `BCRYPT_ROUNDS`         | `10` (`4` em `test`)         | Custo do bcrypt                                                              |
| `LOG_LEVEL`             | `info`                       | Nível de log do pino                                                         |
| `SEED_ON_START`         | —                            | No Docker, `true` popula o banco se estiver vazio                            |

### Web (`apps/web/.env.local`)

| Variável                | Padrão                  | Descrição                                   |
| ----------------------- | ----------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_API_URL`   | `http://localhost:3333` | Endereço da API (usado no build)            |
| `NEXT_PUBLIC_DEMO`      | `false`                 | `true` gera o modo demonstração com MSW     |
| `NEXT_PUBLIC_BASE_PATH` | vazio                   | Caminho base do site (o Pages usa `/fluxo`) |

## Scripts

Na raiz do monorepo:

| Script                              | O que faz                                         |
| ----------------------------------- | ------------------------------------------------- |
| `pnpm dev`                          | API e web em modo desenvolvimento                 |
| `pnpm build`                        | Build de produção da API e da web                 |
| `pnpm build:demo`                   | Build estático do modo demonstração               |
| `pnpm lint` / `pnpm lint:fix`       | ESLint em todo o monorepo                         |
| `pnpm format` / `pnpm format:check` | Prettier                                          |
| `pnpm typecheck`                    | Checagem de tipos de todos os pacotes             |
| `pnpm test`                         | Testes unitários + integração + componentes       |
| `pnpm test:unit`                    | Somente testes unitários                          |
| `pnpm test:integration`             | Testes de integração da API (PostgreSQL)          |
| `pnpm test:e2e`                     | Testes E2E com Playwright (sobe banco, API e web) |
| `pnpm db:migrate`                   | Cria/aplica migrations em desenvolvimento         |
| `pnpm db:deploy`                    | Aplica migrations (produção/CI)                   |
| `pnpm db:seed`                      | Recria os dados de exemplo                        |
| `pnpm check`                        | Lint + tipos + testes + build (o mesmo que o CI)  |

## Testes

| Tipo        | Ferramentas                     | O que cobre                                                                                                                                             |
| ----------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unitários   | Vitest                          | Regras de permissão, ordenação, menções, estatísticas, tokens, armazenamento de arquivos, services com Prisma simulado e o estado do quadro na web      |
| Integração  | Vitest + Supertest + PostgreSQL | **Todas as rotas**, incluindo os erros (400, 401, 403, 404, 409, 413 e 429), rotação de refresh token e Socket.io (salas, presença, eco e notificações) |
| Componentes | Testing Library                 | Modal acessível, cartão, @menções, gráficos, filtros e login                                                                                            |
| E2E         | Playwright                      | Cadastro, criar quadro, mover cartão (mouse e teclado), comentar com menção e tempo real entre dois navegadores                                         |

Os testes de integração precisam de um banco cujo nome contenha `test` (eles apagam as tabelas):

```bash
createdb fluxo_test
```

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fluxo_test pnpm test:integration
```

O E2E usa o banco `fluxo_e2e` e as portas 3334 (API) e 3101 (web):

```bash
createdb fluxo_e2e
```

```bash
pnpm --filter @fluxo/web exec playwright install chromium
```

```bash
pnpm test:e2e
```

O CI no GitHub Actions roda formatação, lint, tipos, testes unitários, build, integração (com PostgreSQL) e E2E a cada push.

## Segurança

- Senhas com **bcrypt**; refresh tokens guardados só como **HMAC-SHA256**, rotacionados a cada uso e com **detecção de reuso** (reapresentar um token antigo encerra a sessão).
- Access token apenas em memória no navegador; refresh token em cookie `httpOnly`, `SameSite=Lax`, restrito a `/api/auth`.
- **Autorização em todas as rotas** por papel no workspace; recursos de outros workspaces respondem 404 para não revelar que existem.
- Validação de todas as entradas com **Zod** (limites de tamanho inclusive) e erros padronizados.
- **Helmet** (CSP, nosniff etc.), **CORS** restrito às origens configuradas e **rate limit** geral, de login e de upload.
- Uploads com lista de tipos permitidos (MIME + extensão), limite de tamanho, nome aleatório no disco e download somente autenticado.
- Markdown renderizado sem HTML cru e links externos com `noopener`.

## Acessibilidade e atalhos

Navegação completa por teclado (inclusive arrastar e soltar), foco visível, modais com foco preso e restaurado, `aria-*` nos componentes, anúncios em português para leitores de tela durante o arraste, contraste AA nos dois temas, alternativa em tabela para os gráficos e respeito a `prefers-reduced-motion`.

| Atalho              | Ação                                  |
| ------------------- | ------------------------------------- |
| `Ctrl` + `K` ou `/` | Busca global e comandos               |
| `?`                 | Lista de atalhos                      |
| `T`                 | Alternar tema                         |
| `G`                 | Ir para os workspaces                 |
| `N`                 | Novo cartão (no quadro)               |
| `F`                 | Filtrar cartões (no quadro)           |
| `D`                 | Abrir/fechar o dashboard do quadro    |
| `Espaço` + setas    | Pegar, mover e soltar o cartão focado |
| `Enter`             | Abrir o cartão focado                 |
| `Ctrl` + `Enter`    | Enviar comentário / salvar descrição  |

## Estrutura de pastas

```text
fluxo/
├── apps/
│   ├── api/                 # API REST + Socket.io
│   │   ├── prisma/          # schema, migrations e seed
│   │   ├── src/
│   │   │   ├── config/      # variáveis de ambiente validadas
│   │   │   ├── docs/        # OpenAPI gerado dos schemas Zod
│   │   │   ├── lib/         # prisma, erros, tokens, mapeadores, ordenação
│   │   │   ├── middlewares/ # autenticação, erros, rate limit
│   │   │   ├── modules/     # auth, workspaces, boards, cards, comments...
│   │   │   └── realtime/    # Socket.io
│   │   └── tests/           # testes de integração (Supertest)
│   └── web/                 # Next.js
│       ├── e2e/             # testes Playwright
│       └── src/
│           ├── app/         # rotas (App Router)
│           ├── components/  # UI, quadro, cartão, gráficos...
│           ├── demo/        # API simulada (MSW) do modo demonstração
│           ├── lib/         # cliente HTTP, autenticação, tempo real, estado do quadro
│           └── styles/      # tokens de tema e estilos globais
├── packages/shared/         # schemas Zod, tipos, permissões, estatísticas, dados de exemplo
├── docs/screenshots/
├── docker-compose.yml
├── PLANO.md                 # plano de desenvolvimento por fases
└── DECISOES.md              # decisões tomadas e seus motivos
```

## Decisões e plano

- [`PLANO.md`](PLANO.md): as 12 fases do projeto, todas concluídas.
- [`DECISOES.md`](DECISOES.md): por que cada escolha foi feita (pnpm, rotas com query string, refresh token rotativo, MSW na demonstração e outras).

## Autor

**Arthur Souza Soares** — estudante de Desenvolvimento de Sistemas no SENAI.

## Licença

[MIT](LICENSE)
