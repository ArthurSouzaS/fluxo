# Registro de decisões

Decisões tomadas de forma autônoma durante o desenvolvimento, com o motivo de cada uma.

## Gerais

1. **Branch de trabalho.** O ambiente em que o projeto foi desenvolvido exige que os commits sejam enviados para a branch `claude/fluxo-project-manager-vdjmfg`. Todo o trabalho foi publicado nela (fase a fase); a integração com a `main` é feita por merge/PR. Os workflows de CI rodam em qualquer branch e o deploy do GitHub Pages roda a partir da `main`.
2. **pnpm workspaces** em vez de npm workspaces: o npm 10 falha ao resolver as peer dependencies opcionais do Vitest 4 (erro interno `edgesOut` do Arborist). O pnpm resolve corretamente, é mais rápido e economiza disco. A versão fica fixada em `packageManager` e é ativada com `corepack enable`.
3. **Versões estáveis e conhecidas**: Next.js 15, React 19, Prisma 6, Express 5, Zod 4, TypeScript 5.9, ESLint 9 (flat config), Vitest 4. Versões "rc" ou majors recém-lançadas foram evitadas.
4. **`bcryptjs` em vez de `bcrypt`**: mesmo algoritmo e mesmo formato de hash, mas em JavaScript puro — não depende de compilação nativa nem de binários baixados na instalação (problemas comuns em Docker Alpine e no Windows).
5. **`packages/shared` consumido como código-fonte TypeScript**: a API é empacotada com `tsup` (que inclui o pacote compartilhado no bundle) e o Next usa `transpilePackages`. Não há etapa de build separada para o pacote compartilhado.
6. **Zod 4 e Vitest 4**: o `npm audit` apontou vulnerabilidades no Zod < 4.6.6 (consumo de memória com coleções grandes) e no Tinypool/Vitest 3. As versões foram atualizadas. O PostCSS embutido no Next 15 também foi forçado para `^8.5.32` via `pnpm.overrides`.
7. **Alerta restante do `pnpm audit`** (`deepmerge-ts`, dentro da CLI do Prisma 6): afeta apenas a ferramenta de linha de comando usada em desenvolvimento/migrations, não o código que roda em produção. O Prisma 7 corrige, mas exige trocar o motor de conexão por _driver adapters_; a migração fica registrada como melhoria futura.
