import { expect, type Page } from '@playwright/test';

export const DEMO_PASSWORD = 'fluxo123';

export async function login(page: Page, email = 'arthur@fluxo.dev', password = DEMO_PASSWORD) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/app$/);
}

export async function openBoard(page: Page, title: string) {
  await page
    .getByRole('link', { name: new RegExp(title) })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

export const column = (page: Page, title: string) =>
  page
    .locator('[data-column-id]')
    .filter({ has: page.getByRole('heading', { level: 2, name: title, exact: true }) });

export const card = (page: Page, title: string) =>
  page.locator('[data-card-id]').filter({ hasText: title });

/** Arrasta com o mouse em passos (o dnd-kit só inicia após 6px). */
export async function dragTo(
  page: Page,
  from: ReturnType<Page['locator']>,
  to: ReturnType<Page['locator']>,
) {
  const source = (await from.boundingBox())!;
  const target = (await to.boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 10, source.y + source.height / 2 + 10, {
    steps: 5,
  });
  await page.mouse.move(target.x + target.width / 2, target.y + 60, { steps: 20 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}
