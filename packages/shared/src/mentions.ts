/** Expressão de uma menção: @apelido (letras minúsculas, números, ponto, hífen e sublinhado). */
const MENTION_REGEX = /(^|[^\w@.])@([a-z0-9](?:[a-z0-9._-]{0,30}[a-z0-9])?)/gi;

/**
 * Extrai os apelidos mencionados em um texto, sem repetição e em minúsculas.
 * Ignora endereços de e-mail (ex.: arthur@fluxo.dev).
 */
export function extractMentions(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(MENTION_REGEX)) {
    const username = match[2];
    if (username) found.add(username.toLowerCase());
  }
  return [...found];
}

/** Gera um apelido a partir de um nome ou e-mail: "Ana Júlia" → "ana.julia". */
export function slugifyUsername(source: string): string {
  const base = source
    .split('@')[0]!
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24);
  return base.length >= 3 ? base : `${base || 'user'}${Math.floor(Math.random() * 900 + 100)}`;
}
