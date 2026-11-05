import styles from './Spinner.module.scss';

export function Spinner({ size = 18, label }: { size?: number; label?: string }) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

/** Carregamento de página inteira. */
export function PageLoader({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className={styles.page} role="status" aria-live="polite">
      <Spinner size={28} />
      <span>{label}</span>
    </div>
  );
}
