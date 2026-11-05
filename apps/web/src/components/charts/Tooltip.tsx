import type { ReactNode } from 'react';
import styles from './charts.module.scss';

export interface TooltipState {
  x: number;
  y: number;
  content: ReactNode;
}

/** Dica flutuante posicionada dentro do contêiner do gráfico. */
export function ChartTooltip({ state, width }: { state: TooltipState | null; width: number }) {
  if (!state) return null;
  const left = Math.min(Math.max(state.x, 8), width - 8);
  return (
    <div className={styles.tooltip} style={{ left, top: state.y }} role="status">
      {state.content}
    </div>
  );
}
