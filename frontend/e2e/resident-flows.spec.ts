import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1366, height: 900 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('op_nav_open', 'true');
    localStorage.setItem(
      'op_users',
      JSON.stringify([
        { id: 'owner_1', username: 'owner', role: 'admin' },
        { id: 'invitee_1', username: 'invitee1', role: 'invitee', ownerId: 'owner_1' },
      ]),
    );
    localStorage.setItem(
      'op_session',
      JSON.stringify({
        userId: 'owner_1',
        previewUserId: null,
        previewPersist: false,
        sessionRole: 'admin',
        sessionUsername: 'owner',
        universeOwnerId: 'owner_1',
        universeId: 'univ_1',
      }),
    );
    localStorage.setItem(
      'op_prefs',
      JSON.stringify({
        owner_1: {
          universeId: 'univ_1',
          universeName: 'Universe 1',
          multiUserEnabled: true,
          allowUniverseGuests: false,
          allowUniverseObservers: false,
          allowUniverseChat: true,
          universeGuestPassword: '',
          universeObserverPassword: '',
          phoneMode: false,
        },
      }),
    );
    localStorage.setItem('op_org_settings', JSON.stringify({ testModeEnabled: false }));
    localStorage.setItem(
      'op_llm_policy_v1:owner_1:univ_1',
      JSON.stringify({
        enabled: true,
        requireActionConfirmation: true,
        maxActionsPerMinute: 20,
        maxTokensPerMinute: 12000,
        allowDestructiveActions: false,
      }),
    );
    localStorage.setItem(
      'op_llm_credential_refs_v1',
      JSON.stringify({
        owner_1: [
          {
            id: 'cred_1',
            userId: 'owner_1',
            alias: 'local-mock',
            provider: 'custom',
            mode: 'clientHeld',
            status: 'verified',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          },
        ],
      }),
    );
    sessionStorage.setItem('op_llm_secret_v1:cred_1', 'test_secret');
  });
});

const openSettingsMultiUser = async (page) => {
  await page.goto('/');
  await page.locator('#topbar-header').waitFor({ state: 'visible', timeout: 60_000 });
  await page.evaluate(() => {
    const ng = (window as any).ng;
    const root = document.querySelector('app-root');
    const component = ng?.getComponent?.(root);
    component?.openSettings?.();
  });
  await page.getByRole('button', { name: 'Multi-user' }).click();
  await expect(page.getByText('LLM residents (beta)')).toBeVisible();
};

test('invite + lease + revoke resident flow works', async ({ page }) => {
  await openSettingsMultiUser(page);
  await page.evaluate(async () => {
    const ng = (window as any).ng;
    const target = document.querySelector('app-multi-user-settings');
    const component = ng?.getComponent?.(target);
    component.residentId.set('res_lease');
    component.residentName.set('Lease Agent');
    component.residentProvider.set('custom');
    component.residentModel.set('mock-1');
    component.residentPermissions.set({
      canWrite: true,
      canMoveDialogs: true,
      canCreateInstances: true,
      canComment: true,
    });
    await component.saveResident();
    await component.grantResidentLease('res_lease', 'Lease Agent');
    await component.revokeResidentLease();
  });
  await expect(page.getByText('No active resident pencil lease.')).toBeVisible();
});

test('permission denial is captured in workflow cards', async ({ page }) => {
  await openSettingsMultiUser(page);
  const result = await page.evaluate(async () => {
    const ng = (window as any).ng;
    const target = document.querySelector('app-multi-user-settings');
    const component = ng?.getComponent?.(target);
    component.residentId.set('res_readonly');
    component.residentName.set('Read Only Agent');
    component.residentProvider.set('custom');
    component.residentModel.set('mock-1');
    component.residentPermissions.set({
      canWrite: false,
      canMoveDialogs: false,
      canCreateInstances: false,
      canComment: true,
    });
    await component.saveResident();

    component.workflowResidentId.set('res_readonly');
    component.workflowCredentialRefId.set('cred_1');
    component.workflowActionType.set('instance.write');
    component.workflowModel.set('mock-1');
    component.workflowPrompt.set('Write this');
    await component.proposeActionCard();

    const first = component.llmActionCards()[0];
    await component.approveActionCard(first.id);
    await component.executeActionCard(first.id);
    const latest = component.llmActionCards()[0];
    return {
      status: latest?.status ?? null,
      errorMessage: latest?.errorMessage ?? null,
    };
  });
  expect(['failed', 'denied']).toContain(result.status);
  expect(result.errorMessage).toBeTruthy();
});

test('spotty network does not break resident workflow shell', async ({ page, context }) => {
  await openSettingsMultiUser(page);
  await context.setOffline(true);
  await page.waitForTimeout(1000);
  await context.setOffline(false);
  await page.waitForTimeout(1000);
  await expect(page.getByText('Resident workflow cards')).toBeVisible();
});
