# Plano de desenvolvimento — Fluxo

Gerenciador de projetos colaborativo em tempo real (estilo Trello/Jira).

- [x] **Fase 1** — Estrutura do monorepo, configurações (ESLint, Prettier, tsconfig), Docker Compose e CI no GitHub Actions
- [x] **Fase 2** — Banco: schema Prisma (usuários, workspaces, membros com papéis, quadros, colunas, cartões, etiquetas, checklists, comentários, anexos, atividades e notificações) e seed com dados realistas em português
- [ ] **Fase 3** — API: autenticação completa, CRUD, permissões por papel, ordenação, busca/filtros, paginação, upload de anexos, log de atividades e Swagger em `/docs`
- [ ] **Fase 4** — Tempo real: Socket.io com salas por quadro, presença e notificações em tempo real (menções com @)
- [ ] **Fase 5** — Web parte 1: login/cadastro, workspaces e quadros, quadro com arrastar e soltar (dnd-kit) e atualização otimista
- [ ] **Fase 6** — Web parte 2: modal do cartão, filtros, busca global (Ctrl+K), central de notificações, configurações de workspace e membros
- [ ] **Fase 7** — Dashboard por quadro com gráficos SVG próprios
- [ ] **Fase 8** — Visual e UX: temas escuro/claro, responsivo, acessível, estados de carregamento/vazio/erro, atalhos de teclado
- [ ] **Fase 9** — Testes: unitários (Vitest), integração (Supertest), componentes e E2E (Playwright)
- [ ] **Fase 10** — Modo demonstração: build estático no GitHub Pages com MSW
- [ ] **Fase 11** — Documentação (README completo)
- [ ] **Fase 12** — Revisão final (bugs, duplicação, segurança e performance)
