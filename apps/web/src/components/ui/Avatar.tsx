import type { UserPublic } from '@fluxo/shared';
import { initials } from '@/lib/format';
import styles from './Avatar.module.scss';

interface AvatarProps {
  user: Pick<UserPublic, 'name' | 'avatarColor'>;
  size?: number;
  /** Mostra o ponto verde de "online". */
  online?: boolean;
  /** Se falso, o avatar é decorativo (o nome já aparece ao lado). */
  labelled?: boolean;
}

export function Avatar({ user, size = 28, online, labelled = true }: AvatarProps) {
  return (
    <span
      className={styles.avatar}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, size * 0.38),
        background: user.avatarColor,
      }}
      title={user.name}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? user.name : undefined}
      aria-hidden={labelled ? undefined : true}
    >
      {initials(user.name)}
      {online ? <span className={styles.online} aria-hidden /> : null}
    </span>
  );
}

export function AvatarGroup({
  users,
  max = 4,
  size = 26,
}: {
  users: UserPublic[];
  max?: number;
  size?: number;
}) {
  const visible = users.slice(0, max);
  const rest = users.length - visible.length;
  return (
    <span className={styles.group}>
      {visible.map((user) => (
        <Avatar key={user.id} user={user} size={size} />
      ))}
      {rest > 0 ? (
        <span className={styles.more} style={{ width: size, height: size }} title={`Mais ${rest}`}>
          +{rest}
        </span>
      ) : null}
    </span>
  );
}
