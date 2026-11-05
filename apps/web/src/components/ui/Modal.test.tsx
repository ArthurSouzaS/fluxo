import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';

describe('Modal', () => {
  it('é um diálogo acessível com título e foco inicial', () => {
    render(
      <Modal open onClose={() => {}} title="Novo quadro">
        <input aria-label="Título" data-autofocus />
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Novo quadro' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByLabelText('Título')).toHaveFocus();
  });

  it('fecha com Esc e pelo botão Fechar', async () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Teste">
        conteúdo
      </Modal>,
    );
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('mantém o foco dentro do diálogo com Tab', async () => {
    render(
      <Modal open onClose={() => {}} title="Teste">
        <button type="button">Primeiro</button>
        <button type="button">Último</button>
      </Modal>,
    );
    screen.getByRole('button', { name: 'Último' }).focus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();
  });

  it('não renderiza quando fechado', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Oculto">
        x
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ConfirmDialog chama onConfirm', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Excluir?"
        description="Tem certeza?"
        confirmLabel="Excluir"
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
