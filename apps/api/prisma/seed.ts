/**
 * Popula o banco com dados realistas em português.
 *
 * Uso:
 *   pnpm db:seed               → apaga tudo e recria os dados de exemplo
 *   tsx prisma/seed.ts --if-empty → só popula se não houver usuários (usado no Docker)
 *
 * Todos os usuários de exemplo usam a senha "fluxo123".
 */
import 'dotenv/config';
import { PrismaClient, type Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { extractMentions, POSITION_STEP } from '@fluxo/shared';
import { DEMO_PASSWORD, demoUsers, demoWorkspaces } from '@fluxo/shared/demo';

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number, hour = 10): Date {
  const date = new Date(Date.now() - days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
}

function daysFromNow(days: number): Date {
  const date = new Date(Date.now() + days * DAY);
  date.setHours(18, 0, 0, 0);
  return date;
}

async function clearDatabase() {
  // A ordem respeita as chaves estrangeiras (o cascade cuida do resto).
  await prisma.notification.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  const ifEmpty = process.argv.includes('--if-empty');
  if (ifEmpty && (await prisma.user.count()) > 0) {
    console.info('Banco já possui dados — seed ignorado.');
    return;
  }

  await clearDatabase();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = new Map<string, { id: string; name: string; username: string }>();
  for (const [index, user] of demoUsers.entries()) {
    const created = await prisma.user.create({
      data: {
        name: user.name,
        email: user.email,
        username: user.username,
        avatarColor: user.avatarColor,
        passwordHash,
        createdAt: daysAgo(60 - index),
      },
    });
    users.set(user.key, created);
  }
  const userId = (key: string) => {
    const user = users.get(key);
    if (!user) throw new Error(`Usuário de exemplo desconhecido: ${key}`);
    return user.id;
  };

  let cardCount = 0;
  for (const ws of demoWorkspaces) {
    const owner = ws.members.find((m) => m.role === 'OWNER')!;
    const workspace = await prisma.workspace.create({
      data: {
        name: ws.name,
        description: ws.description,
        createdAt: daysAgo(45),
        members: {
          create: ws.members.map((m) => ({
            userId: userId(m.user),
            role: m.role,
            joinedAt: daysAgo(44),
          })),
        },
      },
    });
    const usernames = new Map(ws.members.map((m) => [users.get(m.user)!.username, m.user]));

    await prisma.activity.create({
      data: {
        workspaceId: workspace.id,
        actorId: userId(owner.user),
        type: 'workspace.created',
        createdAt: daysAgo(45),
      },
    });

    for (const b of ws.boards) {
      const board = await prisma.board.create({
        data: {
          workspaceId: workspace.id,
          title: b.title,
          description: b.description,
          color: b.color,
          createdById: userId(b.createdBy),
          createdAt: daysAgo(43),
        },
      });
      await prisma.activity.create({
        data: {
          workspaceId: workspace.id,
          boardId: board.id,
          actorId: userId(b.createdBy),
          type: 'board.created',
          data: { boardTitle: b.title },
          createdAt: daysAgo(43),
        },
      });

      const labels = new Map<string, string>();
      for (const label of b.labels) {
        const created = await prisma.label.create({
          data: { boardId: board.id, name: label.name, color: label.color },
        });
        labels.set(label.key, created.id);
      }

      for (const [columnIndex, col] of b.columns.entries()) {
        const column = await prisma.boardColumn.create({
          data: {
            boardId: board.id,
            title: col.title,
            position: (columnIndex + 1) * POSITION_STEP,
            isDone: col.isDone ?? false,
            wipLimit: col.wipLimit ?? null,
          },
        });

        for (const [cardIndex, c] of col.cards.entries()) {
          cardCount += 1;
          const createdAt = daysAgo(c.createdDaysAgo, 9);
          const completedAt =
            col.isDone && c.completedDaysAgo !== undefined ? daysAgo(c.completedDaysAgo, 16) : null;

          const card = await prisma.card.create({
            data: {
              boardId: board.id,
              columnId: column.id,
              title: c.title,
              description: c.description ?? '',
              position: (cardIndex + 1) * POSITION_STEP,
              dueDate: c.dueInDays !== undefined ? daysFromNow(c.dueInDays) : null,
              completedAt,
              createdById: userId(c.createdBy),
              createdAt,
              assignees: { create: (c.assignees ?? []).map((u) => ({ userId: userId(u) })) },
              labels: { create: (c.labels ?? []).map((l) => ({ labelId: labels.get(l)! })) },
            },
          });

          const activities: Prisma.ActivityCreateManyInput[] = [
            {
              workspaceId: workspace.id,
              boardId: board.id,
              cardId: card.id,
              actorId: userId(c.createdBy),
              type: 'card.created',
              data: { cardTitle: c.title, columnTitle: b.columns[0]!.title },
              createdAt,
            },
          ];
          if (columnIndex > 0) {
            activities.push({
              workspaceId: workspace.id,
              boardId: board.id,
              cardId: card.id,
              actorId: userId(c.assignees?.[0] ?? c.createdBy),
              type: completedAt ? 'card.completed' : 'card.moved',
              data: {
                cardTitle: c.title,
                fromColumn: b.columns[columnIndex - 1]!.title,
                toColumn: col.title,
              },
              createdAt: completedAt ?? new Date(createdAt.getTime() + DAY),
            });
          }

          for (const [checklistIndex, cl] of (c.checklists ?? []).entries()) {
            await prisma.checklist.create({
              data: {
                cardId: card.id,
                title: cl.title,
                position: (checklistIndex + 1) * POSITION_STEP,
                createdAt,
                items: {
                  create: cl.items.map(([text, done], itemIndex) => ({
                    text,
                    done,
                    position: (itemIndex + 1) * POSITION_STEP,
                  })),
                },
              },
            });
          }

          for (const cm of c.comments ?? []) {
            const commentAt = daysAgo(cm.daysAgo, 14);
            const comment = await prisma.comment.create({
              data: {
                cardId: card.id,
                authorId: userId(cm.author),
                body: cm.body,
                createdAt: commentAt,
              },
            });
            activities.push({
              workspaceId: workspace.id,
              boardId: board.id,
              cardId: card.id,
              actorId: userId(cm.author),
              type: 'comment.created',
              data: { cardTitle: c.title },
              createdAt: commentAt,
            });

            const author = users.get(cm.author)!;
            for (const username of extractMentions(cm.body)) {
              const mentionedKey = usernames.get(username);
              if (!mentionedKey || mentionedKey === cm.author) continue;
              await prisma.notification.create({
                data: {
                  userId: userId(mentionedKey),
                  actorId: author.id,
                  type: 'MENTION',
                  message: `${author.name} mencionou você em "${c.title}"`,
                  data: {
                    workspaceId: workspace.id,
                    boardId: board.id,
                    cardId: card.id,
                    commentId: comment.id,
                  },
                  createdAt: commentAt,
                },
              });
            }
          }

          await prisma.activity.createMany({ data: activities });
        }
      }
    }
  }

  // Algumas notificações de atribuição para o usuário principal.
  const arthurCards = await prisma.card.findMany({
    where: { assignees: { some: { userId: userId('arthur') } }, completedAt: null },
    include: { board: true, createdBy: true },
    take: 2,
    orderBy: { createdAt: 'desc' },
  });
  for (const card of arthurCards) {
    if (card.createdById === userId('arthur') || !card.createdBy) continue;
    await prisma.notification.create({
      data: {
        userId: userId('arthur'),
        actorId: card.createdById,
        type: 'ASSIGNED',
        message: `${card.createdBy.name} atribuiu você ao cartão "${card.title}"`,
        data: { workspaceId: card.board.workspaceId, boardId: card.boardId, cardId: card.id },
        createdAt: daysAgo(2),
      },
    });
  }

  console.info(
    `Seed concluído: ${users.size} usuários, ${demoWorkspaces.length} workspaces, ${cardCount} cartões.`,
  );
  console.info(`Entre com arthur@fluxo.dev / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
