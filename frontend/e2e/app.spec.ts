import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

test('landing loads with mock label and navigation', async ({ page }) => {
  await page.goto('/');

  await page.locator('input[type="text"]').fill('admin');
  await page.locator('input[type="password"]').fill('');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText("Roy's Operator")).toBeVisible();
  await expect(page.getByText('Test mode')).toBeVisible();
  await expect(page.getByText('Workspaces')).toBeVisible();

  await page
    .locator('aside')
    .getByText('Todo Apps')
    .locator('..')
    .getByRole('button', { name: '+' })
    .click();
  await expect(page.locator('.dialog__title', { hasText: 'Todos App' })).toBeVisible();
});

test('can add and delete a todo in mock mode', async ({ page }) => {
  await page.goto('/');

  await page.locator('input[type="text"]').fill('admin');
  await page.locator('input[type="password"]').fill('');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page
    .locator('aside')
    .getByText('Todo Apps')
    .locator('..')
    .getByRole('button', { name: '+' })
    .click();

  await page.getByPlaceholder('Add a todo').fill('Buy milk');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Buy milk')).toBeVisible();

  const row = page.locator('article', { hasText: 'Buy milk' });
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Buy milk')).toHaveCount(0);
});
