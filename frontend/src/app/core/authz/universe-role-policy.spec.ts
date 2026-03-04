import { UniverseAccessContext, getUniversePermissionSet } from './universe-role-policy';

function baseContext(overrides: Partial<UniverseAccessContext> = {}): UniverseAccessContext {
  return {
    sessionUserId: 'user_1',
    sessionRole: 'user',
    universeOwnerId: 'owner_1',
    multiUserEnabled: true,
    universeEditHolderId: null,
    ...overrides,
  };
}

describe('universe-role-policy', () => {
  it('grants owner full control', () => {
    const result = getUniversePermissionSet(
      baseContext({
        sessionUserId: 'owner_1',
        sessionRole: 'admin',
      }),
    );

    expect(result.actorRole).toBe('owner');
    expect(result.canEditUniverse).toBe(true);
    expect(result.canInvite).toBe(true);
    expect(result.canGrantPencil).toBe(true);
    expect(result.canViewOnly).toBe(false);
  });

  it('grants invite/admin actions to admin in non-owned universe', () => {
    const result = getUniversePermissionSet(
      baseContext({
        sessionRole: 'admin',
      }),
    );

    expect(result.actorRole).toBe('admin');
    expect(result.canEditUniverse).toBe(true);
    expect(result.canInvite).toBe(true);
    expect(result.canGrantPencil).toBe(true);
    expect(result.canViewOnly).toBe(false);
  });

  it('grants editor writes only when edit holder in multi-user universes', () => {
    const withoutPencil = getUniversePermissionSet(
      baseContext({
        sessionRole: 'invitee',
        sessionUserId: 'inv_1',
        universeEditHolderId: 'inv_2',
      }),
    );
    const withPencil = getUniversePermissionSet(
      baseContext({
        sessionRole: 'invitee',
        sessionUserId: 'inv_1',
        universeEditHolderId: 'inv_1',
      }),
    );

    expect(withoutPencil.actorRole).toBe('editor');
    expect(withoutPencil.canEditUniverse).toBe(false);
    expect(withoutPencil.canViewOnly).toBe(true);
    expect(withPencil.canEditUniverse).toBe(true);
    expect(withPencil.canViewOnly).toBe(false);
  });

  it('keeps observer and share-viewer readonly', () => {
    const observerResult = getUniversePermissionSet(
      baseContext({
        sessionRole: 'observer',
      }),
    );
    const shareResult = getUniversePermissionSet(
      baseContext({
        sessionRole: 'user',
        viaShareLink: true,
      }),
    );

    expect(observerResult.actorRole).toBe('observer');
    expect(observerResult.canEditUniverse).toBe(false);
    expect(observerResult.canInvite).toBe(false);
    expect(observerResult.canGrantPencil).toBe(false);

    expect(shareResult.actorRole).toBe('share-viewer');
    expect(shareResult.canEditUniverse).toBe(false);
    expect(shareResult.canInvite).toBe(false);
    expect(shareResult.canGrantPencil).toBe(false);
  });

  it('allows editors to edit when multi-user is disabled', () => {
    const result = getUniversePermissionSet(
      baseContext({
        sessionRole: 'user',
        multiUserEnabled: false,
      }),
    );

    expect(result.actorRole).toBe('editor');
    expect(result.canEditUniverse).toBe(true);
    expect(result.canViewOnly).toBe(false);
  });
});
