import { expect, test } from '@playwright/test';

const stories = [
  { id: 'shared-modal-shell--default', name: 'modal-shell-default.png' },
  { id: 'shared-confirm-dialog--default', name: 'confirm-dialog-default.png' },
  { id: 'layout-top-bar--mode-indicators-phone-test', name: 'top-bar-mode-indicators.png' },
  { id: 'layout-app-list--realtime-degraded', name: 'app-list-realtime-degraded.png' },
  {
    id: 'shared-theme-matrix--accessibility-high-contrast',
    name: 'theme-matrix-high-contrast.png',
  },
] as const;

test.describe('storybook visual baseline', () => {
  for (const story of stories) {
    test(story.id, async ({ page }) => {
      await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('#storybook-root')).toBeVisible();
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
            caret-color: transparent !important;
          }
        `,
      });

      await expect(page.locator('#storybook-root')).toHaveScreenshot(story.name, {
        animations: 'disabled',
      });
    });
  }
});
