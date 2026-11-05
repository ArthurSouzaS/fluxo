import type { CardSummary } from '@fluxo/shared';
import { cardSummaryInclude, toCardSummary } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';

/** Busca o resumo atualizado de um cartão (usado nas respostas e nos eventos em tempo real). */
export async function loadCardSummary(cardId: string): Promise<CardSummary> {
  const card = await prisma.card.findUniqueOrThrow({
    where: { id: cardId },
    include: cardSummaryInclude,
  });
  return toCardSummary(card);
}
