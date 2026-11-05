import { expect, test } from '@playwright/test';
import { card, column, dragTo, login, openBoard } from './helpers';

test.describe('Fluxos principais', () => {
  test('cadastro de uma nova conta', async ({ page }) => {
    const email = `nova.${Date.now()}@teste.com`;
    await page.goto('/register');
    await page.getByLabel('Nome').fill('Maria Clara');
    await page.getByLabel('E-mail').fill(email);
    await page.getByLabel('Senha').fill('fraca');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByText('A senha deve ter pelo menos 8 caracteres')).toBeVisible();

    await page.getByLabel('Senha').fill('senhaForte1');
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByRole('heading', { name: /Maria!/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Espaço de Maria' })).toBeVisible();

    // A sessão sobrevive ao recarregar (refresh token em cookie httpOnly).
    await page.reload();
    await expect(page.getByRole('link', { name: 'Espaço de Maria' })).toBeVisible();
  });

  test('criar quadro e cartões', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Novo quadro' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Novo quadro' });
    await dialog.getByLabel('Título').fill('Sprint E2E');
    await dialog.getByText('Sprint', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Criar quadro' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Sprint E2E' })).toBeVisible();
    await expect(page.locator('[data-column-id]')).toHaveCount(5);

    await column(page, 'Backlog').getByRole('button', { name: 'Adicionar cartão' }).click();
    await page.getByLabel('Título do novo cartão em Backlog').fill('Primeira tarefa');
    await page.keyboard.press('Enter');
    await page.getByLabel('Título do novo cartão em Backlog').fill('Segunda tarefa');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect(column(page, 'Backlog').locator('[data-card-id]')).toHaveCount(2);

    await page.reload();
    await expect(card(page, 'Segunda tarefa')).toBeVisible();
  });

  test('mover cartão com o mouse e com o teclado', async ({ page }) => {
    await login(page);
    await openBoard(page, 'Site da Padaria Pão Quente');

    await dragTo(page, card(page, 'Fotos dos produtos'), column(page, 'Fazendo'));
    await expect(
      column(page, 'Fazendo').locator('[data-card-id]').filter({ hasText: 'Fotos dos produtos' }),
    ).toBeVisible();

    // Teclado: Espaço pega, → leva para a próxima coluna, Espaço solta.
    await card(page, 'Formulário de encomenda').focus();
    for (const key of ['Space', 'ArrowRight', 'ArrowRight', 'Space']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(250); // cada passo reorganiza as colunas
    }
    await expect(
      column(page, 'Pronto')
        .locator('[data-card-id]')
        .filter({ hasText: 'Formulário de encomenda' }),
    ).toBeVisible();

    // Persistiu no servidor.
    await page.reload();
    await expect(
      column(page, 'Fazendo').locator('[data-card-id]').filter({ hasText: 'Fotos dos produtos' }),
    ).toBeVisible();
    await expect(
      column(page, 'Pronto')
        .locator('[data-card-id]')
        .filter({ hasText: 'Formulário de encomenda' }),
    ).toBeVisible();
  });

  test('comentar com menção notifica a pessoa mencionada', async ({ page, browser }) => {
    await login(page);
    await openBoard(page, 'Sprint 12 — App Agenda Fácil');
    await card(page, 'Tela de avaliação do atendimento').click();

    const dialog = page.getByRole('dialog');
    const comment = dialog.getByRole('combobox', { name: 'Escrever comentário' });
    await comment.fill('');
    await comment.pressSequentially('Pode revisar, @bea');
    await expect(dialog.getByRole('option', { name: /Beatriz Lima/ })).toBeVisible();
    await page.keyboard.press('Enter');
    await comment.pressSequentially('? Obrigado!');
    await dialog.getByRole('button', { name: 'Comentar' }).click();
    await expect(dialog.getByRole('list', { name: 'Comentários' })).toContainText(
      'Pode revisar, @beatriz ? Obrigado!',
    );

    // Beatriz recebe a notificação.
    const other = await browser.newContext();
    const beatriz = await other.newPage();
    await login(beatriz, 'beatriz@fluxo.dev');
    await beatriz.getByRole('button', { name: /Notificações/ }).click();
    await expect(beatriz.getByRole('dialog', { name: 'Notificações' })).toContainText(
      'Arthur Souza Soares mencionou você em "Tela de avaliação do atendimento"',
    );
    await other.close();
  });

  test('alterações aparecem em tempo real para outra pessoa', async ({ page, browser }) => {
    await login(page);
    await openBoard(page, 'TCC — Documentação');

    const other = await browser.newContext();
    const beatriz = await other.newPage();
    await login(beatriz, 'beatriz@fluxo.dev');
    await openBoard(beatriz, 'TCC — Documentação');

    // Presença: os dois aparecem online.
    await expect(page.getByRole('img', { name: /Online agora: .*Beatriz Lima/ })).toBeVisible();

    await dragTo(page, card(page, 'Diagrama de casos de uso'), column(page, 'Escrevendo'));
    await expect(
      column(beatriz, 'Escrevendo')
        .locator('[data-card-id]')
        .filter({ hasText: 'Diagrama de casos de uso' }),
    ).toBeVisible();

    await column(beatriz, 'A escrever').getByRole('button', { name: 'Adicionar cartão' }).click();
    await beatriz.getByLabel('Título do novo cartão em A escrever').fill('Revisar ABNT');
    await beatriz.keyboard.press('Enter');
    await expect(card(page, 'Revisar ABNT')).toBeVisible();
    await other.close();
  });
});
