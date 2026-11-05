import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/render';
import { routerMock } from '@/test/setup';
import LoginPage from './page';

describe('Página de login', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('valida os campos antes de chamar a API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    renderWithProviders(<LoginPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument();
    expect(screen.getByText('Informe a senha')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('mostra o erro da API para credenciais erradas', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha incorretos' },
        }),
        { status: 401 },
      ),
    );
    renderWithProviders(<LoginPage />);
    await userEvent.type(await screen.findByLabelText('E-mail'), 'ana@teste.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'errada123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos');
  });

  it('entra e redireciona para os workspaces', async () => {
    const session = {
      accessToken: 'token',
      user: {
        id: 'u1',
        name: 'Ana',
        username: 'ana',
        email: 'ana@teste.com',
        avatarColor: '#fff',
        createdAt: '',
      },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(session), { status: 200 }),
    );
    renderWithProviders(<LoginPage />);
    await userEvent.type(await screen.findByLabelText('E-mail'), 'ana@teste.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senhaSegura1');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/app'));
    expect(localStorage.getItem('fluxo:has-session')).toBe('1');
  });
});
