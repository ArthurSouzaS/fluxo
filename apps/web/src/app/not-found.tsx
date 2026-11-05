import Link from 'next/link';
import { buttonClassName } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';

export default function NotFound() {
  return (
    <main
      id="conteudo"
      style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <EmptyState
        icon="search"
        title="Página não encontrada"
        description="O endereço pode ter mudado ou não existe mais."
        action={
          <Link href="/app" className={buttonClassName('primary')}>
            Voltar para o início
          </Link>
        }
      />
    </main>
  );
}
