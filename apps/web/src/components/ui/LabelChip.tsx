import styles from './LabelChip.module.scss';

/** Etiqueta colorida. O texto usa a própria cor sobre um fundo translúcido. */
export function LabelChip({
  name,
  color,
  compact,
}: {
  name: string;
  color: string;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span
        className={styles.bar}
        style={{ background: color }}
        title={name}
        aria-label={`Etiqueta ${name}`}
        role="img"
      />
    );
  }
  return (
    <span className={styles.chip} style={{ ['--label' as string]: color }}>
      <span className={styles.dot} aria-hidden />
      {name}
    </span>
  );
}
