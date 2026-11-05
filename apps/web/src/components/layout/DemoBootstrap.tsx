'use client';

import type { ReactNode } from 'react';

/** No modo demonstração, inicia o MSW antes de renderizar o app (fase 10). */
export function DemoBootstrap({ children }: { children: ReactNode }) {
  return children;
}
