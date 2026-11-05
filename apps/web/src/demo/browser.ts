import { setupWorker } from 'msw/browser';
import { BASE_PATH } from '@/lib/config';
import { handlers } from './handlers';

/** Inicia o Service Worker do MSW, que responde às chamadas da "API" no navegador. */
export async function startDemoWorker() {
  const worker = setupWorker(...handlers);
  await worker.start({
    serviceWorker: {
      url: `${BASE_PATH}/mockServiceWorker.js`,
      options: { scope: `${BASE_PATH}/` },
    },
    onUnhandledRequest: 'bypass',
    quiet: true,
  });
}
