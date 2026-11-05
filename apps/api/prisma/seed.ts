/**
 * Popula o banco com dados realistas em português.
 *
 * Os dados vêm de `createDemoDb()` (@fluxo/shared/demo) — o mesmo conjunto
 * usado pelo modo demonstração da web, então os dois ficam sempre iguais.
 *
 * Uso:
 *   pnpm db:seed                    → apaga tudo e recria os dados de exemplo
 *   tsx prisma/seed.ts --if-empty   → só popula se não houver usuários (Docker)
 *
 * Todos os usuários de exemplo usam a senha "fluxo123".
 */
import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { createDemoDb, DEMO_PASSWORD } from '@fluxo/shared/demo';

const prisma = new PrismaClient();
const date = (iso: string | null) => (iso ? new Date(iso) : null);

async function clearDatabase() {
  // O cascade das chaves estrangeiras cuida das tabelas dependentes.
  await prisma.notification.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  if (process.argv.includes('--if-empty') && (await prisma.user.count()) > 0) {
    console.info('Banco já possui dados — seed ignorado.');
    return;
  }

  const data = createDemoDb();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await clearDatabase();
  await prisma.$transaction(async (tx) => {
    await tx.user.createMany({
      data: data.users.map(({ password: _password, createdAt, ...user }) => ({
        ...user,
        passwordHash,
        createdAt: new Date(createdAt),
      })),
    });
    await tx.workspace.createMany({
      data: data.workspaces.map((ws) => ({ ...ws, createdAt: new Date(ws.createdAt) })),
    });
    await tx.workspaceMember.createMany({
      data: data.members.map((m) => ({ ...m, joinedAt: new Date(m.joinedAt) })),
    });
    await tx.board.createMany({
      data: data.boards.map((b) => ({
        ...b,
        createdAt: new Date(b.createdAt),
        updatedAt: new Date(b.updatedAt),
      })),
    });
    await tx.label.createMany({ data: data.labels });
    await tx.boardColumn.createMany({ data: data.columns });
    await tx.card.createMany({
      data: data.cards.map(({ assigneeIds: _a, labelIds: _l, ...card }) => ({
        ...card,
        dueDate: date(card.dueDate),
        completedAt: date(card.completedAt),
        createdAt: new Date(card.createdAt),
        updatedAt: new Date(card.updatedAt),
      })),
    });
    await tx.cardAssignee.createMany({
      data: data.cards.flatMap((card) =>
        card.assigneeIds.map((userId) => ({ cardId: card.id, userId })),
      ),
    });
    await tx.cardLabel.createMany({
      data: data.cards.flatMap((card) =>
        card.labelIds.map((labelId) => ({ cardId: card.id, labelId })),
      ),
    });
    await tx.checklist.createMany({
      data: data.checklists.map(({ items: _items, ...checklist }) => checklist),
    });
    await tx.checklistItem.createMany({
      data: data.checklists.flatMap((checklist) => checklist.items),
    });
    await tx.comment.createMany({
      data: data.comments.map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      })),
    });
    await tx.activity.createMany({
      data: data.activities.map((a) => ({
        ...a,
        data: a.data as Prisma.InputJsonValue,
        createdAt: new Date(a.createdAt),
      })),
    });
    await tx.notification.createMany({
      data: data.notifications.map((n) => ({
        ...n,
        data: n.data as Prisma.InputJsonValue,
        readAt: date(n.readAt),
        createdAt: new Date(n.createdAt),
      })),
    });
  });

  console.info(
    `Seed concluído: ${data.users.length} usuários, ${data.workspaces.length} workspaces, ${data.cards.length} cartões.`,
  );
  console.info(`Entre com arthur@fluxo.dev / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
