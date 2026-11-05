import { Modal } from '../ui/Modal';
import styles from './ShortcutsDialog.module.scss';

export const SHORTCUTS: Array<{ keys: string[]; description: string; scope: string }> = [
  { keys: ['Ctrl', 'K'], description: 'Busca global e comandos', scope: 'Geral' },
  { keys: ['/'], description: 'Abrir a busca', scope: 'Geral' },
  { keys: ['?'], description: 'Mostrar os atalhos', scope: 'Geral' },
  { keys: ['T'], description: 'Alternar tema claro/escuro', scope: 'Geral' },
  { keys: ['G'], description: 'Ir para os workspaces', scope: 'Geral' },
  { keys: ['Esc'], description: 'Fechar janela ou menu', scope: 'Geral' },
  { keys: ['N'], description: 'Novo cartão na primeira coluna', scope: 'Quadro' },
  { keys: ['F'], description: 'Filtrar cartões', scope: 'Quadro' },
  { keys: ['D'], description: 'Abrir o dashboard do quadro', scope: 'Quadro' },
  {
    keys: ['Espaço'],
    description: 'Pegar/soltar cartão focado (use as setas para mover)',
    scope: 'Quadro',
  },
  { keys: ['Enter'], description: 'Abrir o cartão focado', scope: 'Quadro' },
  { keys: ['Ctrl', 'Enter'], description: 'Enviar comentário', scope: 'Cartão' },
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const scopes = [...new Set(SHORTCUTS.map((shortcut) => shortcut.scope))];
  return (
    <Modal open={open} onClose={onClose} title="Atalhos de teclado" size="md">
      {scopes.map((scope) => (
        <section key={scope} className={styles.section}>
          <h3 className={styles.scope}>{scope}</h3>
          <dl className={styles.list}>
            {SHORTCUTS.filter((shortcut) => shortcut.scope === scope).map((shortcut) => (
              <div key={shortcut.description} className={styles.row}>
                <dt className={styles.keys}>
                  {shortcut.keys.map((key) => (
                    <kbd key={key}>{key}</kbd>
                  ))}
                </dt>
                <dd>{shortcut.description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </Modal>
  );
}
