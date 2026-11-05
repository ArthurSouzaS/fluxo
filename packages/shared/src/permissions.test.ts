import { describe, expect, it } from 'vitest';
import { ROLES } from './permissions';

describe('ROLES', () => {
  it('tem quatro papéis', () => {
    expect(ROLES).toHaveLength(4);
  });
});
