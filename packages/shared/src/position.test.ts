import { describe, expect, it } from 'vitest';
import { arrayMove, POSITION_STEP, positionForIndex, rebalancePositions } from './position';

describe('positionForIndex', () => {
  it('lista vazia recebe a posição padrão', () => {
    expect(positionForIndex([], 0)).toBe(POSITION_STEP);
  });

  it('insere no início usando metade da primeira posição', () => {
    expect(positionForIndex([1024, 2048], 0)).toBe(512);
  });

  it('insere no fim somando o passo', () => {
    expect(positionForIndex([1024, 2048], 2)).toBe(2048 + POSITION_STEP);
  });

  it('insere no meio usando o ponto médio', () => {
    expect(positionForIndex([1024, 2048], 1)).toBe(1536);
  });

  it('limita índices fora do intervalo', () => {
    expect(positionForIndex([1024], 99)).toBe(2048);
    expect(positionForIndex([1024], -5)).toBe(512);
  });

  it('retorna null quando não há espaço entre os vizinhos', () => {
    expect(positionForIndex([1, 1.0001], 1)).toBeNull();
  });
});

describe('rebalancePositions', () => {
  it('gera posições espaçadas', () => {
    expect(rebalancePositions(3)).toEqual([1024, 2048, 3072]);
  });
});

describe('arrayMove', () => {
  it('move sem alterar o original', () => {
    const original = ['a', 'b', 'c'];
    expect(arrayMove(original, 0, 2)).toEqual(['b', 'c', 'a']);
    expect(original).toEqual(['a', 'b', 'c']);
  });
});
