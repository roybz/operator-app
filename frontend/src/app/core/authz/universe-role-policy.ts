import type { UserRole } from '../auth.service';

export type UniverseActorRole = 'owner' | 'admin' | 'editor' | 'observer' | 'share-viewer';

export interface UniverseAccessContext {
  sessionUserId: string | null;
  sessionRole: UserRole | null;
  universeOwnerId: string | null;
  multiUserEnabled: boolean;
  universeEditHolderId: string | null;
  viaShareLink?: boolean;
}

export interface UniversePermissionSet {
  actorRole: UniverseActorRole;
  canEditUniverse: boolean;
  canInvite: boolean;
  canGrantPencil: boolean;
  canViewOnly: boolean;
}

const READ_ONLY_ROLES: readonly UserRole[] = ['observer'];

function normalizeSessionRole(value: UserRole | null | undefined): UserRole {
  return value ?? 'user';
}

function toActorRole(context: UniverseAccessContext): UniverseActorRole {
  if (context.viaShareLink) return 'share-viewer';
  if (
    context.sessionUserId &&
    context.universeOwnerId &&
    context.sessionUserId === context.universeOwnerId
  ) {
    return 'owner';
  }
  const role = normalizeSessionRole(context.sessionRole);
  if (role === 'admin') return 'admin';
  if (role === 'observer') return 'observer';
  return 'editor';
}

function canEditByRole(actorRole: UniverseActorRole, context: UniverseAccessContext): boolean {
  if (actorRole === 'owner' || actorRole === 'admin') {
    return true;
  }
  if (actorRole === 'observer' || actorRole === 'share-viewer') {
    return false;
  }
  const role = normalizeSessionRole(context.sessionRole);
  if (READ_ONLY_ROLES.includes(role)) {
    return false;
  }
  if (!context.multiUserEnabled) {
    return true;
  }
  return Boolean(
    context.universeEditHolderId &&
    context.sessionUserId &&
    context.universeEditHolderId === context.sessionUserId,
  );
}

export function getUniversePermissionSet(context: UniverseAccessContext): UniversePermissionSet {
  const actorRole = toActorRole(context);
  const canEditUniverse = canEditByRole(actorRole, context);
  const canInvite = actorRole === 'owner' || actorRole === 'admin';
  const canGrantPencil = actorRole === 'owner' || actorRole === 'admin';
  const canViewOnly = !canEditUniverse;
  return {
    actorRole,
    canEditUniverse,
    canInvite,
    canGrantPencil,
    canViewOnly,
  };
}

export function canEditUniverse(context: UniverseAccessContext): boolean {
  return getUniversePermissionSet(context).canEditUniverse;
}

export function canInviteToUniverse(context: UniverseAccessContext): boolean {
  return getUniversePermissionSet(context).canInvite;
}

export function canGrantUniversePencil(context: UniverseAccessContext): boolean {
  return getUniversePermissionSet(context).canGrantPencil;
}

export function isUniverseViewOnly(context: UniverseAccessContext): boolean {
  return getUniversePermissionSet(context).canViewOnly;
}
