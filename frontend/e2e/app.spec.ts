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

  const loadingScreen = page.locator('#loading-screen');
  if ((await loadingScreen.count()) > 0) {
    await loadingScreen
      .first()
      .waitFor({ state: 'detached', timeout: 60_000 })
      .catch(() => {});
  }

  await page.locator('#topbar-header').waitFor({ state: 'visible', timeout: 60_000 });

  const accessibilityContinue = page.getByRole('button', { name: /continue/i });
  if ((await accessibilityContinue.count()) && (await accessibilityContinue.isVisible())) {
    await accessibilityContinue.click();
  }

  const expandNav = page.getByRole('button', { name: 'Expand' });
  if ((await expandNav.count()) && (await expandNav.isVisible())) {
    await expandNav.click({ force: true });
  }

  const burger = page.locator('button:has-text("?"), button:has-text("☰")');
  if ((await burger.count()) && (await burger.isVisible())) {
    await burger.click({ force: true });
  }

  await page.locator('#app-viewport').waitFor({ state: 'attached', timeout: 60_000 });
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
  const addTodoInput = todoRoot.getByPlaceholder('Add a todo');
  await addTodoInput.fill('Buy milk');
  await addTodoInput.press('Enter');
  await expect(page.getByText('Buy milk')).toBeVisible();

  await page.evaluate(() => {
    const ng = (window as any).ng;
    const todoRoot = document.querySelector('app-todo-page');
    const component = ng?.getComponent?.(todoRoot);
    const activeProjectId = component?.state?.()?.activeProjectId;
    const project = component?.state?.()?.projects?.find((p) => p.id === activeProjectId);
    const item = project?.todos?.find((t) => t.text === 'Buy milk');
    if (item) {
      void component.onDelete(item);
    }
  });
  await expect(page.getByText('Buy milk')).toHaveCount(0);
});

test('can open all app types from the registry', async ({ page }) => {
  await enterApp(page);

  const appOpenPlan: Array<{ id: string; selector: string }> = [
    { id: 'kanban', selector: 'app-kanban' },
    { id: 'todo', selector: 'app-todo-page' },
    { id: 'calculator', selector: 'app-calculator' },
    { id: 'timer', selector: 'app-timer' },
    { id: 'navigator', selector: 'app-navigator' },
    { id: 'notes', selector: 'app-notes' },
    { id: 'stickyNotes', selector: 'app-sticky-notes' },
    { id: 'calendar', selector: 'app-calendar' },
    { id: 'clock', selector: 'app-clock' },
    { id: 'dataTable', selector: 'app-data-table' },
  ];

  for (const plan of appOpenPlan) {
    await page.evaluate((appId: string) => {
      const ng = (window as any).ng;
      const root = document.querySelector('app-root');
      const component = ng?.getComponent?.(root);
      component?.openApp?.(appId);
    }, plan.id);
    await expect(page.locator(plan.selector).first()).toBeVisible();
  }
});
