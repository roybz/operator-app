import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1366, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('op_nav_open', 'true');
    localStorage.setItem('op_prefs', JSON.stringify({ u_guest: { phoneMode: false } }));
    localStorage.setItem(
      'op_session',
      JSON.stringify({
        userId: 'u_guest',
        previewUserId: null,
        previewPersist: false,
        sessionRole: 'user',
        sessionUsername: 'guest',
        universeOwnerId: null,
        universeId: null,
      }),
    );
  });
});

const enterApp = async (page) => {
  await page.goto('/');
  const guestButton = page.getByRole('button', { name: 'Continue as guest' });
  if ((await guestButton.count()) && (await guestButton.isVisible())) {
    await guestButton.click();
  }
  await page.locator('#loading-screen').waitFor({ state: 'detached' });
  await page.locator('#app-viewport').waitFor({ state: 'attached' });

  const expandNav = page.getByRole('button', { name: 'Expand' });
  if ((await expandNav.count()) && (await expandNav.isVisible())) {
    await expandNav.click({ force: true });
  }
  const burger = page.locator('button:has-text("☰")');
  if ((await burger.count()) && (await burger.isVisible())) {
    await burger.click({ force: true });
  }
  await page.waitForFunction(() => {
    const ng = (window as any).ng;
    const root = document.querySelector('app-root');
    return Boolean(ng?.getComponent?.(root));
  });
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

  await page.evaluate(() => {
    const ng = (window as any).ng;
    const root = document.querySelector('app-root');
    const component = ng?.getComponent?.(root);
    component?.openApp?.('todo');
  });
  await expect(page.locator('app-todo-page')).toBeVisible();
});

test('can open additional applications', async ({ page }) => {
  await enterApp(page);

  await page.evaluate(() => {
    const ng = (window as any).ng;
    const root = document.querySelector('app-root');
    const component = ng?.getComponent?.(root);
    component?.openApp?.('calculator');
  });
  await expect(page.locator('app-calculator')).toBeVisible();

  await page.evaluate(() => {
    const ng = (window as any).ng;
    const root = document.querySelector('app-root');
    const component = ng?.getComponent?.(root);
    component?.openApp?.('timer');
  });
  await expect(page.locator('app-timer')).toBeVisible();

  await page.evaluate(() => {
    const ng = (window as any).ng;
    const root = document.querySelector('app-root');
    const component = ng?.getComponent?.(root);
    component?.openApp?.('notes');
  });
  await expect(page.locator('app-notes').first()).toBeVisible();

  await page.evaluate(() => {
    const ng = (window as any).ng;
    const root = document.querySelector('app-root');
    const component = ng?.getComponent?.(root);
    component?.openApp?.('stickyNotes');
  });
  await expect(page.locator('app-sticky-notes').first()).toBeVisible();

  await page.evaluate(() => {
    const ng = (window as any).ng;
    const root = document.querySelector('app-root');
    const component = ng?.getComponent?.(root);
    component?.openApp?.('dataTable');
  });
  await expect(page.locator('app-data-table').first()).toBeVisible();
});

test('can add and delete a todo in mock mode', async ({ page }) => {
  await enterApp(page);

  await page.evaluate(() => {
    const ng = (window as any).ng;
    const root = document.querySelector('app-root');
    const component = ng?.getComponent?.(root);
    component?.openApp?.('todo');
  });

  const todoRoot = page.locator('app-todo-page');
  await todoRoot.locator('input').first().fill('Buy milk');
  await todoRoot.getByRole('button', { name: 'Add' }).click();
  await expect(page.getByText('Buy milk')).toBeVisible();

  const row = page.locator('article', { hasText: 'Buy milk' });
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Buy milk')).toHaveCount(0);
});
