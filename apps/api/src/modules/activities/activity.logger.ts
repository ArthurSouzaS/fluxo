import type { Prisma } from '@prisma/client';
import type { ActivityData, ActivityType } from '@fluxo/shared';
import { prisma } from '../../lib/prisma';

interface LogActivityInput {
  workspaceId: string;
  boardId?: string | null;
  cardId?: string | null;
  actorId: string | null;
  type: ActivityType;
  data?: ActivityData;
}

type Tx = Prisma.TransactionClient;

/** Registra uma entrada no histórico. Aceita uma transação opcional. */
export async function logActivity(input: LogActivityInput, tx: Tx = prisma) {
  await tx.activity.create({
    data: {
      workspaceId: input.workspaceId,
      boardId: input.boardId ?? null,
      cardId: input.cardId ?? null,
      actorId: input.actorId,
      type: input.type,
      data: (input.data ?? {}) as Prisma.InputJsonValue,
    },
  });
}
