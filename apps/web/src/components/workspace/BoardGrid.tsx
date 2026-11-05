import Link from 'next/link';
import type { BoardSummary } from '@fluxo/shared';
import { formatRelative } from '@/lib/format';
import { Icon } from '../ui/Icon';
import styles from './BoardGrid.module.scss';

export function BoardGrid({ boards, onCreate }: { boards: BoardSummary[]; onCreate?: () => void }) {
  return (
    <ul className={styles.grid}>
      {boards.map((board) => (
        <li key={board.id}>
          <Link
            href={`/board?id=${board.id}`}
            className={styles.board}
            style={{ ['--board' as string]: board.color }}
          >
            <span className={styles.stripe} aria-hidden />
            <span className={styles.title}>{board.title}</span>
            {board.description ? (
              <span className={styles.description}>{board.description}</span>
            ) : null}
            <span className={styles.meta}>
              <span>
                <Icon name="text" size={12} /> {board.cardCount}{' '}
                {board.cardCount === 1 ? 'cartão' : 'cartões'}
              </span>
              <span>atualizado {formatRelative(board.updatedAt)}</span>
            </span>
          </Link>
        </li>
      ))}
      {onCreate ? (
        <li>
          <button type="button" className={styles.create} onClick={onCreate}>
            <Icon name="plus" size={18} />
            Novo quadro
          </button>
        </li>
      ) : null}
    </ul>
  );
}
