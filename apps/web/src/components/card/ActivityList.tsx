import { describeActivity, type Activity, type ActivityData } from '@fluxo/shared';
import { formatFullDate, formatRelative } from '@/lib/format';
import { Avatar } from '../ui/Avatar';
import styles from './ActivityList.module.scss';

export function ActivityList({ activities }: { activities: Activity[]; showCard?: boolean }) {
  if (activities.length === 0) return <p className={styles.empty}>Nenhuma atividade registrada.</p>;
  return (
    <ol className={styles.list}>
      {activities.map((activity) => (
        <li key={activity.id} className={styles.item}>
          {activity.actor ? (
            <Avatar user={activity.actor} size={26} labelled={false} />
          ) : (
            <span className={styles.placeholder} />
          )}
          <p className={styles.text}>
            <strong>{activity.actor?.name ?? 'Alguém'}</strong>{' '}
            {describeActivity(activity.type, activity.data as ActivityData)}
            <time
              className={styles.time}
              dateTime={activity.createdAt}
              title={formatFullDate(activity.createdAt)}
            >
              {formatRelative(activity.createdAt)}
            </time>
          </p>
        </li>
      ))}
    </ol>
  );
}
