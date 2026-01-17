import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
  });
});

test('landing loads with mock label and navigation', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Operator App' })).toBeVisible();
  await expect(page.getByText('Mock mode')).toBeVisible();
  await expect(page.getByText('Welcome to Operator App.')).toBeVisible();

  await page.getByRole('link', { name: 'Todo app' }).click();
  await expect(page.getByRole('heading', { name: 'Todos App' })).toBeVisible();
});

test('can add and delete a todo in mock mode', async ({ page }) => {
  await page.goto('/todo');

  await page.getByPlaceholder('Add a todo').fill('Buy milk');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Buy milk')).toBeVisible();

  const row = page.locator('article', { hasText: 'Buy milk' });
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Buy milk')).toHaveCount(0);
});
