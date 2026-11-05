import Link from 'next/link';
import type { ReactNode } from 'react';
import { DemoBanner } from '../layout/DemoBanner';
import { Icon } from '../ui/Icon';
import styles from './AuthLayout.module.scss';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className={styles.page}>
      <DemoBanner />
      <div className={styles.wrapper}>
        <section className={styles.hero} aria-hidden>
          <div className={styles.heroContent}>
            <span className={styles.logo}>
              <Icon name="logo" size={22} />
            </span>
            <p className={styles.tagline}>
              Organize projetos em equipe, <em>em tempo real</em>.
            </p>
            <ul className={styles.features}>
              <li>
                <Icon name="board" size={16} /> Quadros kanban com arrastar e soltar
              </li>
              <li>
                <Icon name="users" size={16} /> Colaboração ao vivo, com presença e menções
              </li>
              <li>
                <Icon name="chart" size={16} /> Dashboard com o andamento de cada quadro
              </li>
            </ul>
            <div className={styles.preview}>
              {['A fazer', 'Fazendo', 'Feito'].map((column, index) => (
                <div key={column} className={styles.previewColumn}>
                  <span>{column}</span>
                  {Array.from({ length: 3 - index }, (_, i) => (
                    <i key={i} style={{ width: `${90 - i * 18}%` }} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>
        <main id="conteudo" className={styles.formSide}>
          <div className={styles.card}>
            <Link href="/" className={styles.brand}>
              <span className={styles.logoSmall}>
                <Icon name="logo" size={16} />
              </span>
              fluxo
            </Link>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
            {children}
            <p className={styles.footer}>{footer}</p>
          </div>
        </main>
      </div>
    </div>
  );
}
