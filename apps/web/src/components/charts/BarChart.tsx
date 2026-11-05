'use client';

import { useState } from 'react';
import { useElementWidth } from '@/lib/hooks/useElementWidth';
import { hBarPath } from './geometry';
import { ChartTooltip, type TooltipState } from './Tooltip';
import styles from './charts.module.scss';

export interface BarSegment {
  label: string;
  value: number;
  color: string;
}

export interface BarRow {
  key: string;
  label: string;
  /** Cor de identidade da categoria (ex.: cor da etiqueta), mostrada como marcador ao lado do texto. */
  swatch?: string;
  segments: BarSegment[];
}

const ROW = 34;
const BAR = 16;
const GAP = 2;
const LABEL_WIDTH = 150;
const VALUE_SPACE = 40;

/**
 * Barras horizontais (simples ou empilhadas). Cada linha inteira é a área de
 * hover/foco; a dica mostra cada segmento. O total aparece na ponta da barra.
 */
export function BarChart({
  rows,
  unit = 'cartões',
  ariaLabel,
}: {
  rows: BarRow[];
  unit?: string;
  ariaLabel: string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const labelWidth = Math.min(LABEL_WIDTH, width * 0.38);
  const plotWidth = Math.max(40, width - labelWidth - VALUE_SPACE);
  const max = Math.max(1, ...rows.map((row) => row.segments.reduce((sum, s) => sum + s.value, 0)));
  const height = rows.length * ROW + 4;

  const show = (row: BarRow, index: number, x: number) =>
    setTooltip({
      x,
      y: index * ROW,
      content: (
        <>
          <strong>{row.label}</strong>
          {row.segments.map((segment) => (
            <span key={segment.label} className={styles.tooltipRow}>
              <span className={styles.swatch} style={{ background: segment.color }} aria-hidden />
              {segment.label}: {segment.value}
            </span>
          ))}
        </>
      ),
    });

  return (
    <div ref={ref} className={styles.chart} onMouseLeave={() => setTooltip(null)}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        <line x1={labelWidth} x2={labelWidth} y1={0} y2={height} className={styles.baseline} />
        {rows.map((row, index) => {
          const y = index * ROW + (ROW - BAR) / 2;
          const total = row.segments.reduce((sum, s) => sum + s.value, 0);
          let x = labelWidth;
          const visible = row.segments.filter((segment) => segment.value > 0);
          return (
            <g
              key={row.key}
              className={styles.row}
              tabIndex={0}
              role="img"
              aria-label={`${row.label}: ${row.segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}
              onMouseMove={(event) =>
                show(row, index, event.clientX - (ref.current?.getBoundingClientRect().left ?? 0))
              }
              onFocus={() => show(row, index, labelWidth + 40)}
              onBlur={() => setTooltip(null)}
            >
              <rect x={0} y={index * ROW} width={width} height={ROW} className={styles.hit} />
              {row.swatch ? (
                <circle cx={6} cy={index * ROW + ROW / 2} r={4} fill={row.swatch} />
              ) : null}
              <text
                x={row.swatch ? 16 : 0}
                y={index * ROW + ROW / 2}
                dominantBaseline="central"
                className={styles.label}
              >
                {row.label.length > 20 ? `${row.label.slice(0, 19)}…` : row.label}
              </text>
              {visible.map((segment, segmentIndex) => {
                const segmentWidth = (segment.value / max) * plotWidth;
                const isLast = segmentIndex === visible.length - 1;
                // 2px de "respiro" entre segmentos empilhados.
                const drawn = isLast ? segmentWidth : Math.max(0, segmentWidth - GAP);
                const path = isLast
                  ? hBarPath(x, y, drawn, BAR)
                  : `M${x},${y}h${drawn}v${BAR}h${-drawn}Z`;
                x += segmentWidth;
                return <path key={segment.label} d={path} fill={segment.color} />;
              })}
              <text
                x={labelWidth + (total / max) * plotWidth + 8}
                y={index * ROW + ROW / 2}
                dominantBaseline="central"
                className={styles.value}
              >
                {total}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTooltip state={tooltip} width={width} />
      <span className="visually-hidden">Valores em {unit}.</span>
    </div>
  );
}
