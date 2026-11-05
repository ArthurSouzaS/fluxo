import { describe, expect, it } from 'vitest';
import { describeActivity } from './activity';

describe('describeActivity', () => {
  it('descreve movimentação de cartão', () => {
    expect(
      describeActivity('card.moved', {
        cardTitle: 'Login',
        fromColumn: 'A fazer',
        toColumn: 'Feito',
      }),
    ).toBe('moveu "Login" de A fazer para Feito');
  });

  it('tem texto padrão para tipos desconhecidos', () => {
    expect(describeActivity('qualquer.coisa', {})).toBe('fez uma alteração');
  });
});
