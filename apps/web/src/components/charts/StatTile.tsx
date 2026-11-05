import { Icon, type IconName } from '../ui/Icon';
import styles from './charts.module.scss';

/** Indicador numérico. O tom "alerta" usa ícone + texto, nunca só a cor. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  icon: IconName;
  tone?: 'alert' | 'good';
}) {
  return (
    <div className={[styles.tile, tone && styles[tone]].filter(Boolean).join(' ')}>
      <span className={styles.tileLabel}>
        <Icon name={icon} size={14} />
        {label}
      </span>
      <span className={styles.tileValue}>{value.toLocaleString('pt-BR')}</span>
      {hint ? <span className={styles.tileHint}>{hint}</span> : null}
    </div>
  );
}
