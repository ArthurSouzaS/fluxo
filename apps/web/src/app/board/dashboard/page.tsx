'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart } from '@/components/charts/BarChart';
import { ChartCard } from '@/components/charts/ChartCard';
import { ColumnChart } from '@/components/charts/ColumnChart';
import { StatTile } from '@/components/charts/StatTile';
import styles from '@/components/dashboard/Dashboard.module.scss';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { buttonClassName } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { boardsApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { formatShortDate } from '@/lib/format';
import { useHotkeys } from '@/lib/hooks/useHotkeys';
import { useBoardRealtime } from '@/lib/realtime/useBoardRealtime';

const COLORS = {
  single: 'var(--chart-single)',
  open: 'var(--chart-open)',
  done: 'var(--chart-done)',
};

function daysLate(iso: string) {
  return Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

function weekLabel(isoDay: string) {
  const [, month, day] = isoDay.split('-');
  return `${day}/${month}`;
}

function DashboardContent() {
  const id = useSearchParams().get('id') ?? '';
  const router = useRouter();
  const board = useQuery({
    queryKey: queryKeys.board(id),
    queryFn: () => boardsApi.get(id),
    enabled: !!id,
  });
  const stats = useQuery({
    queryKey: queryKeys.boardStats(id),
    queryFn: () => boardsApi.stats(id),
    enabled: !!id,
  });
  // Os números se atualizam sozinhos quando alguém mexe no quadro.
  useBoardRealtime(id || null);
  useHotkeys([{ combo: 'd', handler: () => router.push(`/board?id=${id}`) }]);

  const crumbs = [
    { label: 'Workspaces', href: '/app' },
    ...(board.data ? [{ label: board.data.title, href: `/board?id=${id}` }] : []),
    { label: 'Dashboard' },
  ];

  if (stats.isError || board.isError) {
    return (
      <AppShell crumbs={crumbs}>
        <ErrorState
          error={stats.error ?? board.error}
          onRetry={() => void Promise.all([stats.refetch(), board.refetch()])}
        />
      </AppShell>
    );
  }

  const data = stats.data;
  const completionRate =
    data && data.totals.total ? Math.round((data.totals.done / data.totals.total) * 100) : 0;

  return (
    <AppShell crumbs={crumbs}>
      <PageHeader
        title={`Dashboard${board.data ? ` · ${board.data.title}` : ''}`}
        description="Andamento do quadro, atualizado em tempo real."
        actions={
          <Link href={`/board?id=${id}`} className={buttonClassName()}>
            <Icon name="board" size={16} /> Voltar ao quadro
          </Link>
        }
      />

      {!data ? (
        <div className={styles.tiles} aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={96} radius={12} />
          ))}
        </div>
      ) : (
        <>
          <div className={styles.tiles}>
            <StatTile
              label="Em aberto"
              value={data.totals.open}
              icon="text"
              hint={`de ${data.totals.total} cartões`}
            />
            <StatTile
              label="Concluídos"
              value={data.totals.done}
              icon="check"
              tone="good"
              hint={`${completionRate}% do total`}
            />
            <StatTile
              label="Atrasados"
              value={data.totals.overdue}
              icon="alert"
              tone={data.totals.overdue ? 'alert' : undefined}
              hint="prazo vencido e não concluídos"
            />
            <StatTile
              label="Vencem em 7 dias"
              value={data.totals.dueThisWeek}
              icon="calendar"
              hint="em aberto"
            />
          </div>

          <div className={styles.grid}>
            <ChartCard
              title="Cartões por status"
              description="Quantidade de cartões em cada coluna"
              empty={data.byColumn.length === 0}
              table={{
                columns: ['Coluna', 'Cartões'],
                rows: data.byColumn.map((c) => [
                  c.title + (c.isDone ? ' (concluída)' : ''),
                  c.count,
                ]),
              }}
            >
              <BarChart
                ariaLabel="Cartões por coluna"
                rows={data.byColumn.map((column) => ({
                  key: column.columnId,
                  label: column.title,
                  segments: [{ label: 'Cartões', value: column.count, color: COLORS.single }],
                }))}
              />
            </ChartCard>

            <ChartCard
              title="Cartões por responsável"
              description="Em aberto e concluídos de cada pessoa (um cartão pode ter várias)"
              legend={[
                { label: 'Em aberto', color: COLORS.open },
                { label: 'Concluídos', color: COLORS.done },
              ]}
              empty={data.byAssignee.length === 0}
              table={{
                columns: ['Responsável', 'Em aberto', 'Concluídos'],
                rows: data.byAssignee.map((a) => [a.name, a.open, a.done]),
              }}
            >
              <BarChart
                ariaLabel="Cartões em aberto e concluídos por responsável"
                rows={data.byAssignee.map((assignee) => ({
                  key: assignee.userId ?? 'none',
                  label: assignee.name,
                  segments: [
                    { label: 'Em aberto', value: assignee.open, color: COLORS.open },
                    { label: 'Concluídos', value: assignee.done, color: COLORS.done },
                  ],
                }))}
              />
            </ChartCard>

            <ChartCard
              title="Concluídos por semana"
              description="Últimas 8 semanas (semana começando na segunda-feira)"
              empty={data.completedPerWeek.every((week) => week.count === 0)}
              table={{
                columns: ['Semana de', 'Concluídos'],
                rows: data.completedPerWeek.map((w) => [weekLabel(w.weekStart), w.count]),
              }}
            >
              <ColumnChart
                ariaLabel="Cartões concluídos por semana"
                color={COLORS.done}
                data={data.completedPerWeek.map((week) => ({
                  key: week.weekStart,
                  label: weekLabel(week.weekStart),
                  description: `Semana de ${weekLabel(week.weekStart)}`,
                  value: week.count,
                }))}
              />
            </ChartCard>

            <ChartCard
              title="Cartões por etiqueta"
              empty={data.byLabel.every((label) => label.count === 0)}
              table={{
                columns: ['Etiqueta', 'Cartões'],
                rows: data.byLabel.map((l) => [l.name, l.count]),
              }}
            >
              <BarChart
                ariaLabel="Cartões por etiqueta"
                rows={data.byLabel
                  .filter((label) => label.count > 0)
                  .map((label) => ({
                    key: label.labelId,
                    label: label.name,
                    swatch: label.color,
                    segments: [{ label: 'Cartões', value: label.count, color: COLORS.single }],
                  }))}
              />
            </ChartCard>
          </div>

          <section className={styles.overdue} aria-labelledby="overdue-title">
            <h2 id="overdue-title" className={styles.overdueTitle}>
              <Icon name="alert" size={16} /> Atrasados ({data.totals.overdue})
            </h2>
            {data.overdue.length === 0 ? (
              <p className={styles.muted}>Nenhum cartão atrasado. 🎉</p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Cartão</th>
                      <th scope="col">Coluna</th>
                      <th scope="col">Prazo</th>
                      <th scope="col">Responsáveis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.overdue.map((card) => (
                      <tr key={card.id}>
                        <th scope="row">
                          <Link href={`/board?id=${id}&card=${card.id}`}>{card.title}</Link>
                        </th>
                        <td>{card.columnTitle}</td>
                        <td>
                          <span className={styles.late}>
                            <Icon name="clock" size={12} /> {formatShortDate(card.dueDate)} ·{' '}
                            {daysLate(card.dueDate)} {daysLate(card.dueDate) === 1 ? 'dia' : 'dias'}{' '}
                            de atraso
                          </span>
                        </td>
                        <td>{card.assignees.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
