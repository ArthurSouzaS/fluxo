# Plano de desenvolvimento — Fluxo

Gerenciador de projetos colaborativo em tempo real (estilo Trello/Jira).

- [x] **Fase 1** — Estrutura do monorepo, configurações (ESLint, Prettier, tsconfig), Docker Compose e CI no GitHub Actions
- [x] **Fase 2** — Banco: schema Prisma (usuários, workspaces, membros com papéis, quadros, colunas, cartões, etiquetas, checklists, comentários, anexos, atividades e notificações) e seed com dados realistas em português
- [x] **Fase 3** — API: autenticação completa, CRUD, permissões por papel, ordenação, busca/filtros, paginação, upload de anexos, log de atividades e Swagger em `/docs`
- [x] **Fase 4** — Tempo real: Socket.io com salas por quadro, presença e notificações em tempo real (menções com @)
- [x] **Fase 5** — Web parte 1: login/cadastro, workspaces e quadros, quadro com arrastar e soltar (dnd-kit) e atualização otimista
- [x] **Fase 6** — Web parte 2: modal do cartão, filtros, busca global (Ctrl+K), central de notificações, configurações de workspace e membros
- [x] **Fase 7** — Dashboard por quadro com gráficos SVG próprios
- [x] **Fase 8** — Visual e UX: temas escuro/claro, responsivo, acessível, estados de carregamento/vazio/erro, atalhos de teclado
- [x] **Fase 9** — Testes: unitários (Vitest), integração (Supertest), componentes e E2E (Playwright)
- [x] **Fase 10** — Modo demonstração: build estático no GitHub Pages com MSW
- [x] **Fase 11** — Documentação (README completo)
- [x] **Fase 12** — Revisão final (bugs, duplicação, segurança e performance)

## Resultado

Todas as fases foram concluídas. Na última validação:

| Verificação                                                      | Resultado                    |
| ---------------------------------------------------------------- | ---------------------------- |
| Prettier, ESLint (com jsx-a11y) e TypeScript                     | sem erros em todo o monorepo |
| Testes unitários (shared, API e web)                             | 118 passando                 |
| Testes de integração da API (Supertest + PostgreSQL + Socket.io) | 103 passando                 |
| Testes E2E (Playwright)                                          | 5 fluxos passando            |
| Build de produção (API e web) e build estático da demonstração   | ok                           |

### O que a revisão final (fase 12) corrigiu

- **Segurança:** `trust proxy` agora é configurável (`TRUST_PROXY`, padrão 0), evitando burlar o rate limit com `X-Forwarded-For` forjado; o cabeçalho `x-socket-id` só omite eventos do socket de quem realmente fez a ação; contraste e foco revisados.
- **Bugs:** foco/Esc do modal na primeira abertura; Enter iniciando arraste em vez de abrir o cartão; cursor pulando depois de escolher uma @menção; comentários novos marcados como "editados"; 401 desnecessário ao recarregar; página alargando no celular; link de cartão de outro quadro.
- **Código duplicado:** dados de exemplo gerados por uma única função para o seed e a demonstração; paletas, etiquetas padrão e modelos de quadro centralizados no pacote compartilhado.
- **Pendências conhecidas:** o `docker compose build` não pôde ser executado no ambiente de desenvolvimento (sem acesso à internet dentro dos containers de build) — os artefatos de produção foram validados fora do Docker; o alerta do `pnpm audit` restante é da CLI do Prisma 6 (ferramenta de desenvolvimento).
