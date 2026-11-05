import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api/client';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import styles from './States.module.scss';

export function EmptyState({
  icon = 'sparkles',
  title,
  description,
  action,
  compact,
}: {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={[styles.state, compact && styles.compact].filter(Boolean).join(' ')}>
      <span className={styles.icon}>
        <Icon name={icon} size={22} />
      </span>
      <h3 className={styles.title}>{title}</h3>
      {description ? <p className={styles.description}>{description}</p> : null}
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return 'Algo deu errado. Tente novamente.';
}

export function ErrorState({
  error,
  onRetry,
  title = 'Não foi possível carregar',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const notFound = error instanceof ApiError && error.status === 404;
  return (
    <div className={styles.state} role="alert">
      <span className={[styles.icon, styles.error].join(' ')}>
        <Icon name="alert" size={22} />
      </span>
      <h3 className={styles.title}>{notFound ? 'Não encontrado' : title}</h3>
      <p className={styles.description}>
        {notFound ? 'Isto não existe mais ou você não tem acesso.' : errorMessage(error)}
      </p>
      {onRetry && !notFound ? (
        <div className={styles.action}>
          <Button icon="activity" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function Skeleton({
  width = '100%',
  height = 14,
  radius = 6,
}: {
  width?: number | string;
  height?: number;
  radius?: number;
}) {
  return (
    <span className={styles.skeleton} style={{ width, height, borderRadius: radius }} aria-hidden />
  );
}
