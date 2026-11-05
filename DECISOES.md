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

## API

8. **Refresh token opaco + rotação com detecção de reuso.** O refresh token é um valor aleatório guardado no banco apenas como HMAC-SHA256. A cada uso ele é revogado e substituído; se um token já revogado for reapresentado, toda a "família" (sessão) é encerrada. Ele trafega só em cookie `httpOnly` (`SameSite=Lax`, `Path=/api/auth`); o access token (JWT de 15 min) fica apenas em memória na web.
9. **404 em vez de 403 para quem não é membro.** Recursos de workspaces dos quais o usuário não participa respondem 404, para não revelar que existem. Membros sem permissão para a ação recebem 403.
10. **Posições em ponto flutuante.** Mover um cartão/coluna atualiza só uma linha (ponto médio entre vizinhos). Quando não há mais espaço, a lista é renumerada e o evento `cards.reordered` é enviado.
11. **Coluna "concluída" (`isDone`).** Em vez de um status separado, cada quadro marca quais colunas significam "feito". Entrar nelas preenche `completedAt` (usado no dashboard); sair limpa.
12. **Workspace pessoal no cadastro.** Todo usuário novo ganha um "Espaço de Fulano", para poder criar quadros imediatamente.
13. **Convites apenas para usuários cadastrados.** Adicionar membro exige que o e-mail já tenha conta (sem envio de e-mail, que exigiria um serviço SMTP).
14. **Apelido (`username`) para menções.** Gerado do nome no cadastro (ex.: `ana.julia`) e editável no perfil. Menções a quem não é membro do workspace são ignoradas.
15. **Anexos em disco local** com nome aleatório (UUID) no servidor, lista de tipos permitidos (MIME + extensão precisam bater), limite de tamanho e download apenas autenticado. A permissão é verificada antes de gravar o arquivo.
16. **Swagger gerado dos schemas Zod** (`z.toJSONSchema`), para a documentação nunca divergir da validação.
17. **Rate limit**: 300 req/min por IP na API, 20 tentativas de login/cadastro com falha a cada 15 min e 20 uploads/min. Desligado nos testes automatizados (exceto no teste específico de rate limit).

## Tempo real

18. **Barramento de eventos desacoplado.** Os services publicam em `realtimeBus` sem conhecer o Socket.io; o módulo de tempo real se inscreve ao subir o servidor. Isso deixa os services testáveis sem socket e permite trocar o transporte no futuro (ex.: Redis adapter para várias instâncias).
19. **Sem eco para quem originou a ação.** A web envia o id do socket no cabeçalho `x-socket-id`; o evento vai para a sala `board:<id>` exceto esse socket, porque a interface dele já foi atualizada de forma otimista.
20. **Autenticação no handshake** com o access token. Ao entrar em um quadro, a permissão é conferida; quando os membros mudam, a sala é revalidada e quem perdeu acesso é removido. Uma conexão já aberta continua válida após o token expirar (a web reconecta com um token novo ao renovar a sessão).
