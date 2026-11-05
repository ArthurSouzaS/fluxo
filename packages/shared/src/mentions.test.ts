import { describe, expect, it } from 'vitest';
import { extractMentions, slugifyUsername } from './mentions';

describe('extractMentions', () => {
  it('encontra menções simples', () => {
    expect(extractMentions('Oi @arthur, pode revisar?')).toEqual(['arthur']);
  });

  it('remove duplicadas e normaliza para minúsculas', () => {
    expect(extractMentions('@Ana e @ana e @carlos.r')).toEqual(['ana', 'carlos.r']);
  });

  it('ignora e-mails', () => {
    expect(extractMentions('mande para arthur@fluxo.dev')).toEqual([]);
  });

  it('não inclui pontuação final', () => {
    expect(extractMentions('Valeu @diana.')).toEqual(['diana']);
  });

  it('aceita menção no início e após quebra de linha', () => {
    expect(extractMentions('@bia\n@caio olhem isso')).toEqual(['bia', 'caio']);
  });
});

describe('slugifyUsername', () => {
  it('remove acentos e espaços', () => {
    expect(slugifyUsername('Ana Júlia Gonçalves')).toBe('ana.julia.goncalves');
  });

  it('usa a parte local do e-mail', () => {
    expect(slugifyUsername('joao_silva@gmail.com')).toBe('joao.silva');
  });

  it('completa apelidos muito curtos', () => {
    expect(slugifyUsername('Li')).toMatch(/^li\d{3}$/);
  });
});
