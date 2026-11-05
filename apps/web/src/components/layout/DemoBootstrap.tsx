'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { IS_DEMO } from '@/lib/config';
import { PageLoader } from '../ui/Spinner';

/**
 * No modo demonstração (GitHub Pages, sem back-end), inicia o MSW antes
 * de renderizar o app. Fora dele, não faz nada (o código nem entra no bundle).
 */
export function DemoBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!IS_DEMO);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!IS_DEMO) return;
    import('@/demo/browser')
      .then(({ startDemoWorker }) => startDemoWorker())
      .then(() => setReady(true))
      .catch((error) => {
        console.error(error);
        setFailed(true);
      });
  }, []);

  if (failed) {
    return (
      <p role="alert" style={{ padding: 24 }}>
        Não foi possível iniciar a demonstração neste navegador (Service Workers indisponíveis).
        Tente outro navegador ou desative o modo privado.
      </p>
    );
  }
  if (!ready) return <PageLoader label="Preparando a demonstração..." />;
  return children;
}
