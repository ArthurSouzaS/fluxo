import {
  dueStatus,
  formatBytes,
  formatRelative,
  fromDateInput,
  initials,
  toDateInput,
} from './format';
import { matchesCombo } from './hooks/useHotkeys';
import { safeNext } from './forms';

describe('format', () => {
  const now = new Date('2026-06-10T12:00:00Z').getTime();

  it('situação do prazo', () => {
    expect(dueStatus('2026-06-09T00:00:00Z', null, now)).toBe('overdue');
    expect(dueStatus('2026-06-11T00:00:00Z', null, now)).toBe('soon');
    expect(dueStatus('2026-06-20T00:00:00Z', null, now)).toBe('later');
    expect(dueStatus('2026-06-09T00:00:00Z', '2026-06-08T00:00:00Z', now)).toBe('done');
  });

  it('tempo relativo em português', () => {
    expect(formatRelative('2026-06-10T11:59:50Z', now)).toBe('agora');
    expect(formatRelative('2026-06-10T11:55:00Z', now)).toBe('há 5 minutos');
    expect(formatRelative('2026-06-09T12:00:00Z', now)).toBe('ontem');
  });

  it('ida e volta do campo de data', () => {
    const iso = fromDateInput('2026-03-15')!;
    expect(toDateInput(iso)).toBe('2026-03-15');
    expect(fromDateInput('')).toBeNull();
  });

  it('tamanhos e iniciais', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1,5 KB');
    expect(initials('Arthur Souza Soares')).toBe('AS');
    expect(initials('Ana')).toBe('A');
  });
});

describe('atalhos e navegação', () => {
  it('reconhece combinações', () => {
    expect(matchesCombo(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }), 'mod+k')).toBe(
      true,
    );
    expect(matchesCombo(new KeyboardEvent('keydown', { key: 'k', metaKey: true }), 'mod+k')).toBe(
      true,
    );
    expect(matchesCombo(new KeyboardEvent('keydown', { key: 'k' }), 'mod+k')).toBe(false);
    expect(matchesCombo(new KeyboardEvent('keydown', { key: 'n', ctrlKey: true }), 'n')).toBe(
      false,
    );
  });

  it('safeNext só aceita caminhos internos', () => {
    expect(safeNext('/board?id=1')).toBe('/board?id=1');
    expect(safeNext('//malicioso.com')).toBe('/app');
    expect(safeNext('https://malicioso.com')).toBe('/app');
    expect(safeNext(null)).toBe('/app');
  });
});
