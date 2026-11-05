/**
 * Banco de dados em memória do modo demonstração: o mesmo conjunto de dados
 * do seed da API (gerado em @fluxo/shared/demo), salvo no localStorage.
 */
import { createDemoDb, DEMO_DATASET_VERSION, type DemoDb } from '@fluxo/shared/demo';

export * from '@fluxo/shared/demo';

const STORAGE_KEY = 'fluxo:demo-db';

export function loadDemoDb(): DemoDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDb;
      if (parsed.version === DEMO_DATASET_VERSION) return parsed;
    }
  } catch {
    // Dados corrompidos ou armazenamento indisponível: recomeça.
  }
  return createDemoDb();
}

export function saveDemoDb(db: DemoDb) {
  try {
    // Anexos ficam só em memória (podem ser grandes demais para o localStorage).
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...db, attachments: db.attachments.map((a) => ({ ...a, dataUrl: '' })) }),
    );
  } catch {
    // Sem espaço ou modo privado: as alterações valem até recarregar a página.
  }
}

export function resetDemoDb() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignora
  }
}
