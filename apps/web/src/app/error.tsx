'use client';

import { ErrorState } from '@/components/ui/States';

/** Limite de erro global: evita tela branca se algo quebrar na renderização. */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main
      id="conteudo"
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <ErrorState error={error} onRetry={reset} title="Algo deu errado" />
    </main>
  );
}
