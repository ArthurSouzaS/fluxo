# Registro de decisões

Decisões tomadas de forma autônoma durante o desenvolvimento, com o motivo de cada uma.

## Gerais

1. **Branch de trabalho.** O ambiente em que o projeto foi desenvolvido exige que os commits sejam enviados para a branch `claude/fluxo-project-manager-vdjmfg`. Todo o trabalho foi publicado nela (fase a fase); a integração com a `main` é feita por merge/PR. Os workflows de CI rodam em qualquer branch e o deploy do GitHub Pages roda a partir da `main`.
2. **npm workspaces** em vez de pnpm: já vem com o Node, reduz uma dependência de ferramenta para quem for clonar o projeto.
3. **Versões estáveis e conhecidas**: Next.js 15, React 19, Prisma 6, Express 5, Zod 3, TypeScript 5.9, ESLint 9 (flat config), Vitest 3. Versões "rc" ou majors recém-lançadas foram evitadas.
4. **`bcryptjs` em vez de `bcrypt`**: mesmo algoritmo e mesmo formato de hash, mas em JavaScript puro — não depende de compilação nativa nem de binários baixados na instalação (problemas comuns em Docker Alpine e no Windows).
5. **`packages/shared` consumido como código-fonte TypeScript**: a API é empacotada com `tsup` (que inclui o pacote compartilhado no bundle) e o Next usa `transpilePackages`. Não há etapa de build separada para o pacote compartilhado.
