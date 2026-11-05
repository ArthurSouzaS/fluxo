'use client';

import { IS_DEMO } from '@/lib/config';
import { Icon } from '../ui/Icon';
import styles from './DemoBanner.module.scss';

const DEMO_DB_KEY = 'fluxo:demo-db';

/** Aviso fixo exibido no modo demonstração (sem back-end). */
export function DemoBanner() {
  if (!IS_DEMO) return null;
  const reset = () => {
    if (
      !window.confirm(
        'Restaurar os dados de exemplo? Suas alterações na demonstração serão perdidas.',
      )
    )
      return;
    try {
      localStorage.removeItem(DEMO_DB_KEY);
    } catch {
      // ignora
    }
    window.location.reload();
  };
  return (
    <div className={styles.banner} role="note">
      <Icon name="sparkles" size={14} />
      <strong>Modo demonstração</strong>
      <span className={styles.text}>
        — sem servidor: os dados são de exemplo e ficam só no seu navegador. Tempo real simulado.
      </span>
      <button type="button" className={styles.reset} onClick={reset}>
        Restaurar dados
      </button>
    </div>
  );
}
