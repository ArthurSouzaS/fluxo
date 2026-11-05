'use client';

import { useState } from 'react';
import { useElementWidth } from '@/lib/hooks/useElementWidth';
import { columnPath, niceTicks } from './geometry';
import { ChartTooltip, type TooltipState } from './Tooltip';
import styles from './charts.module.scss';

export interface ColumnDatum {
  key: string;
  label: string;
  /** Texto completo para a dica e leitores de tela. */
  description: string;
  value: number;
}

const HEIGHT = 220;
const PAD = { top: 20, right: 8, bottom: 28, left: 32 };
const MAX_COLUMN = 24;

/** Colunas verticais (série única) com grade horizontal discreta. */
export function ColumnChart({
  data,
  color,
  ariaLabel,
}: {
  data: ColumnDatum[];
  color: string;
  ariaLabel: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const ticks = niceTicks(Math.max(...data.map((d) => d.value), 1));
  const top = ticks.at(-1)!;
  const plotWidth = Math.max(60, width - PAD.left - PAD.right);
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotWidth / Math.max(1, data.length);
  const columnWidth = Math.min(MAX_COLUMN, slot * 0.6);
  const baseline = PAD.top + plotHeight;
  const scale = (value: number) => (value / top) * plotHeight;
  // Rótulos seletivos: só o maior valor e o último ponto.
  const maxValue = Math.max(...data.map((d) => d.value));
  const labelled = new Set([
    data.findIndex((d) => d.value === maxValue && d.value > 0),
    data.length - 1,
  ]);

  return (
    <div ref={ref} className={styles.chart} onMouseLeave={() => setTooltip(null)}>
      <svg width={width} height={HEIGHT} role="img" aria-label={ariaLabel}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={baseline - scale(tick)}
              y2={baseline - scale(tick)}
              className={tick === 0 ? styles.baseline : styles.grid}
            />
            <text
              x={PAD.left - 8}
              y={baseline - scale(tick)}
              textAnchor="end"
              dominantBaseline="central"
              className={styles.axis}
            >
              {tick}
            </text>
          </g>
        ))}
        {data.map((datum, index) => {
          const x = PAD.left + index * slot + (slot - columnWidth) / 2;
          const height = scale(datum.value);
          return (
            <g
              key={datum.key}
              className={styles.row}
              tabIndex={0}
              role="img"
              aria-label={`${datum.description}: ${datum.value}`}
              onMouseEnter={() =>
                setTooltip({
                  x: x + columnWidth / 2,
                  y: baseline - height - 8,
                  content: (
                    <>
                      <strong>{datum.description}</strong>
                      <span>{datum.value} concluídos</span>
                    </>
                  ),
                })
              }
              onFocus={() =>
                setTooltip({
                  x: x + columnWidth / 2,
                  y: baseline - height - 8,
                  content: (
                    <>
                      <strong>{datum.description}</strong>
                      <span>{datum.value} concluídos</span>
                    </>
                  ),
                })
              }
              onBlur={() => setTooltip(null)}
            >
              <rect
                x={PAD.left + index * slot}
                y={PAD.top}
                width={slot}
                height={plotHeight}
                className={styles.hit}
              />
              <path d={columnPath(x, baseline, columnWidth, height)} fill={color} />
              {labelled.has(index) && datum.value > 0 ? (
                <text
                  x={x + columnWidth / 2}
                  y={baseline - height - 6}
                  textAnchor="middle"
                  className={styles.value}
                >
                  {datum.value}
                </text>
              ) : null}
              <text
                x={x + columnWidth / 2}
                y={HEIGHT - 8}
                textAnchor="middle"
                className={styles.axis}
              >
                {datum.label}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTooltip state={tooltip} width={width} />
    </div>
  );
}
