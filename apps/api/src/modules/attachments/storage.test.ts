import { describe, expect, it } from 'vitest';
import { sanitizeFileName, storedFilePath } from './storage';

describe('storage', () => {
  it('remove caminhos e caracteres perigosos do nome original', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('a<b>:c?.txt')).toBe('a_b_c_.txt');
    expect(sanitizeFileName('')).toBe('arquivo');
  });

  it('corrige nomes UTF-8 recebidos como latin1', () => {
    expect(sanitizeFileName(Buffer.from('relatório.pdf').toString('latin1'))).toBe('relatório.pdf');
  });

  it('impede path traversal no nome salvo', () => {
    expect(() => storedFilePath('../segredo.txt')).toThrow();
    expect(storedFilePath('abc.txt')).toMatch(/abc\.txt$/);
  });
});
