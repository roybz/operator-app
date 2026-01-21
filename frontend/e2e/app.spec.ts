import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

const enterApp = async (page) => {
  await page.goto('/');
  const guestButton = page.getByRole('button', { name: 'Continue as guest' });
  if (await guestButton.count()) {
    await guestButton.click();
  }
  await page.locator('#loading-screen').waitFor({ state: 'detached' });
};

test('landing loads with mock label and navigation', async ({ page }) => {
  await enterApp(page);

  await expect(page.getByText('Operator App')).toBeVisible();
  await expect(page.getByText('Test mode')).toBeVisible();
  await expect(page.getByText('Workspaces')).toBeVisible();

  await page
    .locator('aside')
    .getByText('Todo')
    .locator('..')
    .getByRole('button', { name: '+' })
    .click({ force: true });
  await expect(page.locator('.dialog__title', { hasText: 'Todo' })).toBeVisible();
});

test('can open additional applications', async ({ page }) => {
  await enterApp(page);

  await page
    .locator('aside')
    .getByText('Calculator')
    .locator('..')
    .getByRole('button', { name: '+' })
    .click({ force: true });
  await expect(page.locator('.dialog__title', { hasText: 'Calculator' })).toBeVisible();

  await page
    .locator('aside')
    .getByText('Timer')
    .locator('..')
    .getByRole('button', { name: '+' })
    .click({ force: true });
  await expect(page.locator('.dialog__title', { hasText: 'Timer' })).toBeVisible();

  await page
    .locator('aside')
    .getByText('Notes')
    .locator('..')
    .getByRole('button', { name: '+' })
    .click({ force: true });
  await expect(page.locator('.dialog__title', { hasText: 'Notes' })).toBeVisible();
});

test('can add and delete a todo in mock mode', async ({ page }) => {
  await enterApp(page);

  await page
    .locator('aside')
    .getByText('Todo')
    .locator('..')
    .getByRole('button', { name: '+' })
    .click({ force: true });

  await page.getByPlaceholder('Add a todo').fill('Buy milk');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Buy milk')).toBeVisible();

  const row = page.locator('article', { hasText: 'Buy milk' });
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Buy milk')).toHaveCount(0);
});
