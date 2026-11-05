import { IS_DEMO } from '@/lib/config';
import { Icon } from '../ui/Icon';
import styles from './DemoBanner.module.scss';

/** Aviso fixo exibido no modo demonstração (sem back-end). */
export function DemoBanner() {
  if (!IS_DEMO) return null;
  return (
    <div className={styles.banner} role="note">
      <Icon name="sparkles" size={14} />
      <strong>Modo demonstração</strong>
      <span className={styles.text}>
        — os dados são de exemplo e ficam só no seu navegador. Tempo real e anexos são simulados.
      </span>
    </div>
  );
}
