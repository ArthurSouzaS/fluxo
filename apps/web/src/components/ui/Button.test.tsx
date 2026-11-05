import { render, screen } from '@testing-library/react';
import { Button, IconButton } from './Button';

describe('Button', () => {
  it('desabilita e marca como ocupado durante o carregamento', () => {
    render(<Button loading>Salvar</Button>);
    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });

  it('IconButton tem nome acessível e badge', () => {
    render(<IconButton icon="bell" label="Notificações" badge={120} />);
    const button = screen.getByRole('button', { name: 'Notificações' });
    expect(button).toHaveTextContent('99+');
    expect(button).toHaveAttribute('type', 'button');
  });
});
