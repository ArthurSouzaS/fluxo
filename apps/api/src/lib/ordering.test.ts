import { describe, expect, it } from 'vitest';
import { planMove } from './ordering';

describe('planMove', () => {
  it('usa o ponto médio quando há espaço', () => {
    const plan = planMove(
      [
        { id: 'a', position: 1024 },
        { id: 'b', position: 2048 },
      ],
      1,
    );
    expect(plan).toEqual({ position: 1536, rebalanced: null });
  });

  it('coloca no fim de uma lista vazia', () => {
    expect(planMove([], 0)).toEqual({ position: 1024, rebalanced: null });
  });

  it('renumera a lista quando os vizinhos estão colados', () => {
    const plan = planMove(
      [
        { id: 'a', position: 1 },
        { id: 'b', position: 1.0001 },
        { id: 'c', position: 5 },
      ],
      1,
    );
    expect(plan.position).toBe(2048);
    expect(plan.rebalanced).toEqual([
      { id: 'a', position: 1024 },
      { id: 'b', position: 3072 },
      { id: 'c', position: 4096 },
    ]);
  });

  it('renumera ao inserir no início quando a primeira posição é mínima', () => {
    const plan = planMove([{ id: 'a', position: 0.001 }], 0);
    expect(plan.position).toBe(1024);
    expect(plan.rebalanced).toEqual([{ id: 'a', position: 2048 }]);
  });
});
