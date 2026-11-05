'use client';

import { useId, useState, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import styles from './charts.module.scss';

export interface LegendItem {
  label: string;
  color: string;
}

interface ChartCardProps {
  title: string;
  description?: string;
  legend?: LegendItem[];
  /** Tabela com os mesmos dados (alternativa acessível ao gráfico). */
  table: { columns: string[]; rows: Array<Array<string | number>> };
  children: ReactNode;
  empty?: boolean;
}

export function ChartCard({ title, description, legend, table, children, empty }: ChartCardProps) {
  const id = useId();
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={styles.card} aria-labelledby={`${id}-title`}>
      <header className={styles.cardHeader}>
        <div>
          <h2 id={`${id}-title`} className={styles.cardTitle}>
            {title}
          </h2>
          {description ? <p className={styles.cardDescription}>{description}</p> : null}
        </div>
        {!empty ? (
          <Button
            size="sm"
            variant="ghost"
            icon={showTable ? 'chart' : 'menu'}
            aria-pressed={showTable}
            onClick={() => setShowTable((value) => !value)}
          >
            {showTable ? 'Gráfico' : 'Tabela'}
          </Button>
        ) : null}
      </header>
      {legend && legend.length > 1 && !showTable && !empty ? (
        <ul className={styles.legend} aria-label="Legenda">
          {legend.map((item) => (
            <li key={item.label}>
              <span className={styles.swatch} style={{ background: item.color }} aria-hidden />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      {empty ? (
        <p className={styles.empty}>Sem dados ainda.</p>
      ) : showTable ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="visually-hidden">{title}</caption>
            <thead>
              <tr>
                {table.columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) =>
                    cellIndex === 0 ? (
                      <th key={cellIndex} scope="row">
                        {cell}
                      </th>
                    ) : (
                      <td key={cellIndex}>{cell}</td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </section>
  );
}
