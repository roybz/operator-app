import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

const enterApp = async (page) => {
  await page.goto('/');
  const guestButton = page.getByRole('button', { name: 'Continue as guest' });
  if ((await guestButton.count()) && (await guestButton.isVisible())) {
    await guestButton.click();
  }
  await page.locator('#loading-screen').waitFor({ state: 'detached' });
  await page.locator('aside').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const viewport = document.querySelector('#app-viewport') as HTMLElement | null;
    return !!viewport && viewport.clientWidth > 0 && viewport.clientHeight > 0;
  });
  const accessibilityContinue = page.getByRole('button', { name: /continue/i });
  if ((await accessibilityContinue.count()) && (await accessibilityContinue.isVisible())) {
    await accessibilityContinue.click();
  }
};

test('landing loads with mock label and navigation', async ({ page }) => {
  await enterApp(page);

  await expect(page.getByText('Operator App')).toBeVisible();
  await expect(page.getByText('Test mode')).toBeVisible();
  await expect(page.getByText('Workspaces')).toBeVisible();

  await page
    .locator('app-app-list')
    .getByText('Todo')
    .locator('..')
    .locator('button.app-list__icon--add')
    .click({ force: true });
  await expect(page.locator('app-todo-page')).toBeVisible();
});

test('can open additional applications', async ({ page }) => {
  await enterApp(page);

  await page
    .locator('app-app-list')
    .getByText('Calculator')
    .locator('..')
    .locator('button.app-list__icon--add')
    .click({ force: true });
  await expect(page.locator('app-calculator')).toBeVisible();

  await page
    .locator('app-app-list')
    .getByText('Timer')
    .locator('..')
    .locator('button.app-list__icon--add')
    .click({ force: true });
  await expect(page.locator('app-timer')).toBeVisible();

  await page
    .locator('app-app-list')
    .getByText('🗒️')
    .locator('..')
    .locator('..')
    .locator('button.app-list__icon--add')
    .click({ force: true });
  await expect(page.locator('app-notes')).toBeVisible();

  await page
    .locator('app-app-list')
    .getByText('Sticky Notes')
    .locator('..')
    .locator('button.app-list__icon--add')
    .click({ force: true });
  await expect(page.locator('app-sticky-notes')).toBeVisible();

  await page
    .locator('app-app-list')
    .getByText('Data Table')
    .locator('..')
    .locator('button.app-list__icon--add')
    .click({ force: true });
  await expect(page.locator('app-data-table')).toBeVisible();
});

test('can add and delete a todo in mock mode', async ({ page }) => {
  await enterApp(page);

  await page
    .locator('app-app-list')
    .getByText('Todo')
    .locator('..')
    .locator('button.app-list__icon--add')
    .click({ force: true });

  const todoRoot = page.locator('app-todo-page');
  await todoRoot.locator('input').first().fill('Buy milk');
  await todoRoot.getByRole('button').first().click();
  await expect(page.getByText('Buy milk')).toBeVisible();

  const row = page.locator('article', { hasText: 'Buy milk' });
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Buy milk')).toHaveCount(0);
});
