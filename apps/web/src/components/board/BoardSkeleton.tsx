import { Skeleton } from '../ui/States';

export function BoardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Carregando quadro" style={{ padding: 20 }}>
      <Skeleton height={36} width={280} />
      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        {[5, 3, 4].map((count, column) => (
          <div key={column} style={{ width: 296, display: 'grid', gap: 8 }}>
            <Skeleton height={20} width={140} />
            {Array.from({ length: count }, (_, i) => (
              <Skeleton key={i} height={64} radius={8} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
