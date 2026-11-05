/** Espaçamento padrão entre posições consecutivas. */
export const POSITION_STEP = 1024;
/** Abaixo desta diferença entre vizinhos, a lista é renumerada. */
export const MIN_POSITION_GAP = 0.001;

/**
 * Calcula a posição de um item inserido no índice `index` de uma lista já
 * ordenada de posições (sem o próprio item). Usa o ponto médio entre os
 * vizinhos, o que permite mover um item atualizando apenas uma linha.
 *
 * Retorna `null` quando não há espaço entre os vizinhos — nesse caso
 * a lista deve ser renumerada com `rebalancePositions`.
 */
export function positionForIndex(sortedPositions: number[], index: number): number | null {
  const clamped = Math.max(0, Math.min(index, sortedPositions.length));
  const before = sortedPositions[clamped - 1];
  const after = sortedPositions[clamped];

  if (before === undefined && after === undefined) return POSITION_STEP;
  if (before === undefined) return after! / 2 > MIN_POSITION_GAP ? after! / 2 : null;
  if (after === undefined) return before + POSITION_STEP;
  if (after - before <= MIN_POSITION_GAP * 2) return null;
  return (before + after) / 2;
}

/** Gera posições igualmente espaçadas para `count` itens. */
export function rebalancePositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => (i + 1) * POSITION_STEP);
}

/** Move um item dentro de um array (imutável), útil para atualização otimista. */
export function arrayMove<T>(items: readonly T[], from: number, to: number): T[] {
  const copy = items.slice();
  const [item] = copy.splice(from, 1);
  if (item === undefined) return copy;
  copy.splice(Math.max(0, Math.min(to, copy.length)), 0, item);
  return copy;
}
