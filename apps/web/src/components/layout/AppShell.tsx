'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useHotkeys } from '@/lib/hooks/useHotkeys';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { CommandPalette } from '../command/CommandPalette';
import { NotificationsBell } from '../notifications/NotificationsBell';
import { Avatar } from '../ui/Avatar';
import { IconButton } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Menu } from '../ui/Menu';
import { PageLoader } from '../ui/Spinner';
import { DemoBanner } from './DemoBanner';
import { ShortcutsDialog } from './ShortcutsDialog';
import styles from './AppShell.module.scss';

export interface Crumb {
  label: string;
  href?: string;
}

interface AppShellProps {
  children: ReactNode;
  crumbs?: Crumb[];
  /** Conteúdo ocupa a largura toda (quadro kanban). */
  wide?: boolean;
}

export function AppShell({ children, crumbs = [], wide }: AppShellProps) {
  const { status, user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    if (status === 'anonymous') {
      const next = `${window.location.pathname.replace(process.env.NEXT_PUBLIC_BASE_PATH ?? '', '')}${window.location.search}`;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status, router, pathname]);

  useHotkeys([
    {
      combo: 'mod+k',
      allowInInputs: true,
      handler: (event) => {
        event.preventDefault();
        setSearchOpen((open) => !open);
      },
    },
    { combo: '/', handler: (event) => (event.preventDefault(), setSearchOpen(true)) },
    { combo: '?', handler: () => setShortcutsOpen(true) },
    { combo: 't', handler: toggleTheme },
    { combo: 'g', handler: () => router.push('/app') },
  ]);

  if (status !== 'authenticated' || !user) return <PageLoader />;

  return (
    <div className={[styles.shell, wide && styles.shellWide].filter(Boolean).join(' ')}>
      <DemoBanner />
      <header className={styles.topbar}>
        <Link href="/app" className={styles.brand} aria-label="Fluxo — início">
          <span className={styles.logo}>
            <Icon name="logo" size={18} />
          </span>
          <span className={styles.brandName}>fluxo</span>
        </Link>

        <nav aria-label="Navegação estrutural" className={styles.crumbs}>
          <ol>
            {crumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`}>
                <Icon name="chevronRight" size={14} className={styles.separator} />
                {crumb.href && index < crumbs.length - 1 ? (
                  <Link href={crumb.href}>{crumb.label}</Link>
                ) : (
                  <span aria-current={index === crumbs.length - 1 ? 'page' : undefined}>
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.actions}>
          <button type="button" className={styles.search} onClick={() => setSearchOpen(true)}>
            <Icon name="search" size={15} />
            <span className={styles.searchLabel}>Buscar...</span>
            <kbd className={styles.searchKbd}>Ctrl K</kbd>
          </button>
          <IconButton
            icon="search"
            label="Buscar"
            className={styles.searchMobile}
            onClick={() => setSearchOpen(true)}
          />
          <NotificationsBell />
          <IconButton
            icon={theme === 'dark' ? 'sun' : 'moon'}
            label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
            onClick={toggleTheme}
          />
          <Menu
            items={[
              { label: 'Meus workspaces', icon: 'home', onSelect: () => router.push('/app') },
              {
                label: 'Perfil e senha',
                icon: 'settings',
                onSelect: () => router.push('/settings'),
              },
              {
                label: 'Atalhos de teclado',
                icon: 'keyboard',
                onSelect: () => setShortcutsOpen(true),
              },
              {
                label: 'Sair',
                icon: 'logout',
                danger: true,
                onSelect: () => void logout().then(() => router.replace('/login')),
              },
            ]}
            trigger={(props) => (
              <button
                type="button"
                className={styles.userButton}
                aria-label={`Menu de ${user.name}`}
                {...props}
              >
                <Avatar user={user} size={30} labelled={false} />
              </button>
            )}
          />
        </div>
      </header>

      <main
        id="conteudo"
        className={[styles.main, wide && styles.wide].filter(Boolean).join(' ')}
        tabIndex={-1}
      >
        {children}
      </main>

      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShortcutsDialog open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}
