import { positionForIndex, rebalancePositions } from '@fluxo/shared';

export interface Positioned {
  id: string;
  position: number;
}

export interface MovePlan {
  /** Nova posição do item movido. */
  position: number;
  /** Quando não há espaço entre vizinhos, a lista inteira recebe novas posições. */
  rebalanced: Positioned[] | null;
}

/**
 * Planeja a posição de um item que será colocado no índice `index`
 * de uma lista ordenada de irmãos (sem o próprio item).
 */
export function planMove(siblings: Positioned[], index: number): MovePlan {
  const position = positionForIndex(
    siblings.map((sibling) => sibling.position),
    index,
  );
  if (position !== null) return { position, rebalanced: null };

  const clamped = Math.max(0, Math.min(index, siblings.length));
  const positions = rebalancePositions(siblings.length + 1);
  const rebalanced: Positioned[] = [];
  let cursor = 0;
  for (let i = 0; i < positions.length; i += 1) {
    if (i === clamped) continue;
    rebalanced.push({ id: siblings[cursor]!.id, position: positions[i]! });
    cursor += 1;
  }
  return { position: positions[clamped]!, rebalanced };
}
