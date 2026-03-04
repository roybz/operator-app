import { Injectable, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { APP_REGISTRY } from '../features/dependencies/app-registry';
import { AppId, DialogRect } from '../features/dependencies/app-types';
import { StorageService } from './storage/storage.service';
import { UniverseEventHubService } from './events/universe-event-hub.service';
import {
  isRemoteStorageTooManyRequests,
  isRemoteStorageVersionConflict,
} from './storage/remote-write-utils';
import { getKeySpaceConflictPolicy } from './realtime/key-space-conflict-strategy';

export interface DialogInstance {
  id: string;
  appId: AppId;
  titleKey: string;
  titleOverride?: string;
  instanceNumber?: number;
  rect: DialogRect;
  minimized: boolean;
  stashed: boolean;
  archived?: boolean;
  tileRect?: DialogRect;
  phoneRect?: DialogRect;
  phoneMinimized?: boolean;
  phoneStashed?: boolean;
  phoneTileRect?: DialogRect;
  phoneRestoreRect?: DialogRect;
  phoneMaximized?: boolean;
  z: number;
  isMaximized: boolean;
  restoreRect?: DialogRect;
  deleteLocked?: boolean;
}

export interface Workspace {
  id: string;
  name: string;
}

interface DialogState {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  dialogsByWorkspace: Record<string, DialogInstance[]>;
  hiddenWorkspaces: Record<string, boolean>;
  zCounter: number;
  appCounters: Partial<Record<AppId, number>>;
}

const STATE_KEY = 'op_dialog_state_v1';
const PREVIEW_STATE_KEY = 'op_preview_dialog_state_v1';

const TILE_SIZE = { width: 180, height: 80 };
const PHONE_TILE_SIZE = { width: 140, height: 64 };
const TILE_PADDING = 12;

@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly state = signal<DialogState>(this.defaultState());

  readonly workspaces = this.state.asReadonly();

  private auth = inject(AuthService);
  private storage = inject(StorageService);
  private eventHub = inject(UniverseEventHubService);
  private persistFlushTimer: number | null = null;
  private persistInFlight = false;
  private persistQueued = false;
  private persistBackoffMs = 0;
  private persistConflictStreak = 0;

  constructor() {
    effect(() => {
      const session = this.auth.session();
      if (!session.userId && !session.previewUserId) {
        this.state.set(this.defaultState());
        return;
      }
      this.load();
    });
    effect(() => {
      const session = this.auth.session();
      if (!session.userId && !session.previewUserId) return;
      const activeId = session.userId ? this.auth.getActiveUniverseId(session.userId) : null;
      if (activeId) this.load();
    });
  }

  async hydrate() {
    const session = this.auth.session();
    if (!session.userId && !session.previewUserId) return;
    this.load();
  }

  getWorkspaces() {
    return this.state().workspaces;
  }

  getActiveWorkspaceId() {
    return this.state().activeWorkspaceId;
  }

  getDialogsForWorkspace(workspaceId: string) {
    return this.state().dialogsByWorkspace[workspaceId] ?? [];
  }

  getActiveDialogs() {
    return this.getDialogsForWorkspace(this.getActiveWorkspaceId());
  }

  getAppInstances(appId: AppId, options?: { includeArchived?: boolean }) {
    const includeArchived = options?.includeArchived ?? true;
    return this.getActiveDialogs().filter((instance) => {
      if (instance.appId !== appId) return false;
      if (!includeArchived && instance.archived) return false;
      return true;
    });
  }

  addWorkspace() {
    const workspaces = this.state().workspaces;
    if (workspaces.length >= 12) return false;
    const next = [
      ...workspaces,
      { id: this.uid('ws'), name: `Workspace ${workspaces.length + 1}` },
    ];
    this.state.set({ ...this.state(), workspaces: next });
    this.persist();
    return true;
  }

  switchWorkspace(id: string) {
    if (!this.state().workspaces.some((ws) => ws.id === id)) return;
    this.state.set({ ...this.state(), activeWorkspaceId: id });
    this.persist();
  }

  renameWorkspace(id: string, name: string) {
    const nextName = name.trim();
    if (!nextName) return;
    const next = this.state().workspaces.map((ws) =>
      ws.id === id ? { ...ws, name: nextName } : ws,
    );
    this.state.set({ ...this.state(), workspaces: next });
    this.persist();
  }

  reorderWorkspaces(fromId: string, toId: string) {
    if (fromId === toId) return;
    const workspaces = [...this.state().workspaces];
    const fromIndex = workspaces.findIndex((ws) => ws.id === fromId);
    const toIndex = workspaces.findIndex((ws) => ws.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = workspaces.splice(fromIndex, 1);
    workspaces.splice(toIndex, 0, moved);
    this.state.set({ ...this.state(), workspaces });
    this.persist();
  }

  reorderWorkspaceToIndex(fromId: string, toIndex: number) {
    const workspaces = [...this.state().workspaces];
    const fromIndex = workspaces.findIndex((ws) => ws.id === fromId);
    if (fromIndex < 0) return;
    const boundedIndex = Math.max(0, Math.min(workspaces.length, toIndex));
    const [moved] = workspaces.splice(fromIndex, 1);
    const nextIndex = fromIndex < boundedIndex ? boundedIndex - 1 : boundedIndex;
    workspaces.splice(nextIndex, 0, moved);
    this.state.set({ ...this.state(), workspaces });
    this.persist();
  }

  findWorkspaceForInstance(instanceId: string) {
    for (const [workspaceId, dialogs] of Object.entries(this.state().dialogsByWorkspace)) {
      if (dialogs.some((instance) => instance.id === instanceId)) return workspaceId;
    }
    return null;
  }

  moveInstanceToWorkspace(instanceId: string, targetWorkspaceId: string) {
    const fromWorkspaceId = this.findWorkspaceForInstance(instanceId);
    if (!fromWorkspaceId || fromWorkspaceId === targetWorkspaceId) return;
    const fromDialogs = this.getDialogsForWorkspace(fromWorkspaceId);
    const targetDialogs = this.getDialogsForWorkspace(targetWorkspaceId);
    const instance = fromDialogs.find((item) => item.id === instanceId);
    if (!instance) return;
    const nextInstance = { ...instance, z: this.state().zCounter + 1 };
    const nextFrom = fromDialogs.filter((item) => item.id !== instanceId);
    const nextTarget = [...targetDialogs, nextInstance];
    this.state.set({
      ...this.state(),
      zCounter: nextInstance.z,
      dialogsByWorkspace: {
        ...this.state().dialogsByWorkspace,
        [fromWorkspaceId]: nextFrom,
        [targetWorkspaceId]: nextTarget,
      },
    });
    this.persist();
  }

  closeWorkspace(id: string) {
    const workspaces = this.state().workspaces;
    if (workspaces.length <= 1) return false;
    const remaining = workspaces.filter((ws) => ws.id !== id);
    const targetId =
      this.state().activeWorkspaceId === id ? remaining[0]?.id : this.state().activeWorkspaceId;
    if (!targetId) return false;

    const dialogsByWorkspace: Record<string, DialogInstance[]> = {
      ...this.state().dialogsByWorkspace,
    };
    const closingDialogs = dialogsByWorkspace[id] ?? [];
    const movedDialogs = closingDialogs.map((dialog) => ({ ...dialog, minimized: true }));
    dialogsByWorkspace[targetId] = [...(dialogsByWorkspace[targetId] ?? []), ...movedDialogs];
    delete dialogsByWorkspace[id];

    this.state.set({
      ...this.state(),
      workspaces: remaining,
      activeWorkspaceId: targetId,
      dialogsByWorkspace,
    });
    this.persist();
    return true;
  }

  createInstance(appId: AppId, bounds: DOMRect) {
    const maxPersisted = this.auth.preferences().maxPersistedApps;
    const total = Object.values(this.state().dialogsByWorkspace).reduce(
      (sum, list) => sum + list.length,
      0,
    );
    if (total >= maxPersisted) {
      return { ok: false, message: 'dialogs.error.maxPersisted' };
    }

    const config = APP_REGISTRY[appId];
    const rect = this.centerRect(config.defaultSize, bounds);
    const nextNumber = this.nextInstanceNumber(appId);
    const instance: DialogInstance = {
      id: this.uid('dlg'),
      appId,
      titleKey: config.labelKey,
      instanceNumber: nextNumber,
      rect,
      minimized: false,
      stashed: false,
      archived: false,
      tileRect: undefined,
      phoneRect: undefined,
      phoneMinimized: false,
      phoneStashed: false,
      phoneTileRect: undefined,
      phoneRestoreRect: undefined,
      phoneMaximized: false,
      deleteLocked: false,
      z: this.state().zCounter + 1,
      isMaximized: false,
    };

    const workspaceId = this.getActiveWorkspaceId();
    const dialogs = this.getDialogsForWorkspace(workspaceId);
    const nextDialogs = [...dialogs, instance];

    this.state.set({
      ...this.state(),
      zCounter: instance.z,
      appCounters: {
        ...(this.state().appCounters ?? {}),
        [appId]: Math.max(this.state().appCounters?.[appId] ?? 0, nextNumber),
      },
      dialogsByWorkspace: { ...this.state().dialogsByWorkspace, [workspaceId]: nextDialogs },
    });
    this.persist();
    return { ok: true, instance };
  }

  private nextInstanceNumber(appId: AppId) {
    const used = new Set<number>();
    Object.values(this.state().dialogsByWorkspace).forEach((list) => {
      list.forEach((instance) => {
        if (instance.appId !== appId) return;
        if (typeof instance.instanceNumber === 'number') {
          used.add(instance.instanceNumber);
        }
      });
    });
    let next = 1;
    while (used.has(next)) next += 1;
    return next;
  }

  restoreInstance(instanceId: string) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      minimized: false,
      stashed: false,
    }));
  }

  minimizeInstance(instanceId: string) {
    this.updateInstance(instanceId, (instance) => ({ ...instance, minimized: true }));
  }

  setMinimized(instanceId: string, minimized: boolean) {
    this.updateInstance(instanceId, (instance) => ({ ...instance, minimized }));
  }

  stashInstance(instanceId: string, bounds: DOMRect) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      stashed: true,
      minimized: false,
      tileRect: this.createTileRect(instance, bounds, TILE_SIZE),
    }));
  }

  moveTile(instanceId: string, rect: Partial<DialogRect>, bounds: DOMRect) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      tileRect: instance.tileRect
        ? this.clampTileRect({ ...instance.tileRect, ...rect }, bounds, TILE_SIZE)
        : this.createTileRect(instance, bounds, TILE_SIZE),
    }));
  }

  unstashInstance(instanceId: string) {
    this.updateInstance(instanceId, (instance) => ({ ...instance, stashed: false }));
  }

  setPhoneRect(instanceId: string, rect: DialogRect, bounds: DOMRect) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      phoneRect: this.clampRect(rect, bounds),
    }));
  }

  movePhoneInstance(instanceId: string, rect: Partial<DialogRect>, bounds: DOMRect) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      phoneRect: this.clampRect({ ...(instance.phoneRect ?? instance.rect), ...rect }, bounds),
    }));
  }

  resizePhoneInstance(instanceId: string, rect: Partial<DialogRect>, bounds: DOMRect) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      phoneRect: this.clampRect({ ...(instance.phoneRect ?? instance.rect), ...rect }, bounds),
    }));
  }

  setPhoneMinimized(instanceId: string, minimized: boolean) {
    this.updateInstance(instanceId, (instance) => ({ ...instance, phoneMinimized: minimized }));
  }

  stashPhoneInstance(instanceId: string, bounds: DOMRect) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      phoneStashed: true,
      phoneMinimized: false,
      phoneTileRect: this.findAvailableTileRect(bounds, PHONE_TILE_SIZE, true),
    }));
  }

  movePhoneTile(instanceId: string, rect: Partial<DialogRect>, bounds: DOMRect) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      phoneTileRect: instance.phoneTileRect
        ? this.clampTileRect({ ...instance.phoneTileRect, ...rect }, bounds, PHONE_TILE_SIZE)
        : this.findAvailableTileRect(bounds, PHONE_TILE_SIZE, true),
    }));
  }

  unstashPhoneInstance(instanceId: string) {
    this.updateInstance(instanceId, (instance) => ({ ...instance, phoneStashed: false }));
  }

  togglePhoneMaximize(instanceId: string, bounds: DOMRect) {
    this.updateInstance(instanceId, (instance) => {
      const currentRect = instance.phoneRect ?? instance.rect;
      if (instance.phoneMaximized) {
        return {
          ...instance,
          phoneMaximized: false,
          phoneRect: instance.phoneRestoreRect ?? currentRect,
          phoneRestoreRect: undefined,
        };
      }
      return {
        ...instance,
        phoneMaximized: true,
        phoneRestoreRect: currentRect,
        phoneRect: this.clampRect(
          { x: 0, y: 0, width: bounds.width, height: bounds.height },
          bounds,
        ),
      };
    });
  }

  setTitleOverride(instanceId: string, titleOverride: string | null) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      titleOverride: titleOverride ?? undefined,
    }));
  }

  toggleDeleteLock(instanceId: string) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      deleteLocked: !instance.deleteLocked,
    }));
  }

  archiveInstance(instanceId: string) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      archived: true,
      minimized: false,
      stashed: false,
      phoneMinimized: false,
      phoneStashed: false,
    }));
  }

  unarchiveInstance(instanceId: string) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      archived: false,
    }));
  }

  wipeAppData(appId: AppId) {
    const dialogsByWorkspace: Record<string, DialogInstance[]> = {};
    const removedIds: string[] = [];
    Object.entries(this.state().dialogsByWorkspace).forEach(([workspaceId, dialogs]) => {
      dialogsByWorkspace[workspaceId] = dialogs.filter((instance) => {
        if (instance.appId !== appId) return true;
        removedIds.push(instance.id);
        return false;
      });
    });
    this.state.set({ ...this.state(), dialogsByWorkspace });
    this.persist();

    if (appId === 'todo') {
      removedIds.forEach((id) => {
        const prefix = `op_mock_todos:`;
        this.storage
          .keysSync()
          .filter((key) => key.startsWith(prefix) && key.endsWith(`:${id}`))
          .forEach((key) => void this.storage.removeItem(key));
      });
    }
    return removedIds;
  }

  deleteInstance(instanceId: string) {
    const workspaceId = this.getActiveWorkspaceId();
    const nextDialogs = this.getDialogsForWorkspace(workspaceId).filter(
      (instance) => instance.id !== instanceId,
    );
    this.state.set({
      ...this.state(),
      dialogsByWorkspace: { ...this.state().dialogsByWorkspace, [workspaceId]: nextDialogs },
    });
    this.persist();
  }

  bringToFront(instanceId: string) {
    this.updateInstance(instanceId, (instance) => {
      const nextZ = this.state().zCounter + 1;
      this.state.set({ ...this.state(), zCounter: nextZ });
      return { ...instance, z: nextZ };
    });
  }

  moveInstance(instanceId: string, rect: Partial<DialogRect>, bounds: DOMRect) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      rect: this.clampRect({ ...instance.rect, ...rect }, bounds),
    }));
  }

  resizeInstance(instanceId: string, rect: Partial<DialogRect>, bounds: DOMRect) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      rect: this.clampRect({ ...instance.rect, ...rect }, bounds),
    }));
  }

  toggleMaximize(instanceId: string, bounds: DOMRect) {
    this.updateInstance(instanceId, (instance) => {
      if (instance.isMaximized) {
        return {
          ...instance,
          isMaximized: false,
          rect: instance.restoreRect ?? instance.rect,
          restoreRect: undefined,
        };
      }
      return {
        ...instance,
        isMaximized: true,
        restoreRect: instance.rect,
        rect: this.clampRect({ x: 0, y: 0, width: bounds.width, height: bounds.height }, bounds),
      };
    });
  }

  clampAllToBounds(bounds: DOMRect, usePhone = false) {
    const dialogsByWorkspace = this.state().dialogsByWorkspace;
    const nextDialogsByWorkspace: Record<string, DialogInstance[]> = {};
    Object.entries(dialogsByWorkspace).forEach(([workspaceId, dialogs]) => {
      nextDialogsByWorkspace[workspaceId] = dialogs.map((instance) => {
        if (usePhone) {
          const phoneRect = instance.phoneRect
            ? this.clampRect(instance.phoneRect, bounds)
            : undefined;
          const phoneTileRect = instance.phoneTileRect
            ? this.clampTileRect(instance.phoneTileRect, bounds, PHONE_TILE_SIZE)
            : undefined;
          return { ...instance, phoneRect, phoneTileRect };
        }
        const rect = this.clampRect(instance.rect, bounds);
        const tileRect = instance.tileRect
          ? this.clampTileRect(instance.tileRect, bounds, TILE_SIZE)
          : undefined;
        return { ...instance, rect, tileRect };
      });
    });
    this.state.set({ ...this.state(), dialogsByWorkspace: nextDialogsByWorkspace });
    this.persist();
  }

  resetPositions(mode: 'left' | 'middle', bounds: DOMRect) {
    const workspaceId = this.getActiveWorkspaceId();
    const dialogs = this.getDialogsForWorkspace(workspaceId);
    const nextDialogs = dialogs.map((instance) => {
      if (instance.stashed || instance.archived) return instance;
      const rect =
        mode === 'left' ? { ...instance.rect, x: 0, y: 0 } : this.centerRect(instance.rect, bounds);
      return { ...instance, rect };
    });
    this.state.set({
      ...this.state(),
      dialogsByWorkspace: { ...this.state().dialogsByWorkspace, [workspaceId]: nextDialogs },
    });
    this.persist();
  }

  isWorkspaceHidden(workspaceId: string) {
    return this.state().hiddenWorkspaces[workspaceId] ?? false;
  }

  toggleWorkspaceHidden(workspaceId: string) {
    const current = this.isWorkspaceHidden(workspaceId);
    const hiddenWorkspaces = { ...this.state().hiddenWorkspaces, [workspaceId]: !current };
    this.state.set({ ...this.state(), hiddenWorkspaces });
    this.persist();
  }

  isActiveWorkspaceHidden() {
    return this.isWorkspaceHidden(this.getActiveWorkspaceId());
  }

  private updateInstance(
    instanceId: string,
    updater: (instance: DialogInstance) => DialogInstance,
  ) {
    const workspaceId = this.getActiveWorkspaceId();
    const dialogs = this.getDialogsForWorkspace(workspaceId);
    const nextDialogs = dialogs.map((instance) =>
      instance.id === instanceId ? updater(instance) : instance,
    );
    this.state.set({
      ...this.state(),
      dialogsByWorkspace: { ...this.state().dialogsByWorkspace, [workspaceId]: nextDialogs },
    });
    this.persist();
  }

  private centerRect(rect: DialogRect, bounds: DOMRect) {
    const x = Math.max(0, (bounds.width - rect.width) / 2);
    const y = Math.max(0, (bounds.height - rect.height) / 2);
    return this.clampRect({ ...rect, x, y }, bounds);
  }

  private clampRect(rect: DialogRect, bounds: DOMRect): DialogRect {
    const minWidth = 280;
    const minHeight = 200;
    const width = Math.min(Math.max(rect.width, minWidth), bounds.width);
    const height = Math.min(Math.max(rect.height, minHeight), bounds.height);
    const x = Math.min(Math.max(rect.x, 0), Math.max(0, bounds.width - width));
    const y = Math.min(Math.max(rect.y, 0), Math.max(0, bounds.height - height));
    return { x, y, width, height };
  }

  private createTileRect(
    instance: DialogInstance,
    bounds: DOMRect,
    size: { width: number; height: number },
    rectOverride?: DialogRect,
  ): DialogRect {
    const rect = rectOverride ?? instance.rect;
    const centerX = rect.x + rect.width / 2 - size.width / 2;
    const centerY = rect.y + rect.height / 2 - size.height / 2;
    return {
      x: Math.min(Math.max(centerX, 0), Math.max(0, bounds.width - size.width)),
      y: Math.min(Math.max(centerY, 0), Math.max(0, bounds.height - size.height)),
      width: size.width,
      height: size.height,
    };
  }

  private clampTileRect(
    rect: DialogRect,
    bounds: DOMRect,
    size: { width: number; height: number },
  ): DialogRect {
    const width = size.width;
    const height = size.height;
    const x = Math.min(Math.max(rect.x, 0), Math.max(0, bounds.width - width));
    const y = Math.min(Math.max(rect.y, 0), Math.max(0, bounds.height - height));
    return { x, y, width, height };
  }

  private findAvailableTileRect(
    bounds: DOMRect,
    size: { width: number; height: number },
    usePhone: boolean,
  ): DialogRect {
    const existing = Object.values(this.state().dialogsByWorkspace)
      .flat()
      .map((instance) => (usePhone ? instance.phoneTileRect : instance.tileRect))
      .filter((rect): rect is DialogRect => Boolean(rect));
    const maxX = Math.max(TILE_PADDING, bounds.width - size.width - TILE_PADDING);
    const maxY = Math.max(TILE_PADDING, bounds.height - size.height - TILE_PADDING);
    for (let y = TILE_PADDING; y <= maxY; y += size.height + TILE_PADDING) {
      for (let x = TILE_PADDING; x <= maxX; x += size.width + TILE_PADDING) {
        const candidate = { x, y, width: size.width, height: size.height };
        const overlap = existing.some(
          (rect) =>
            x < rect.x + rect.width &&
            x + size.width > rect.x &&
            y < rect.y + rect.height &&
            y + size.height > rect.y,
        );
        if (!overlap) return candidate;
      }
    }
    return {
      x: TILE_PADDING,
      y: TILE_PADDING,
      width: size.width,
      height: size.height,
    };
  }

  private load() {
    const userKey = this.userStorageKey();
    let raw = this.getRaw(userKey);
    if (!raw) {
      const legacyKey = this.legacyUserStorageKey();
      if (legacyKey) {
        const legacy = this.getRaw(legacyKey);
        if (legacy) {
          this.setRaw(userKey, legacy);
          raw = legacy;
        }
      }
    }
    if (!raw) {
      this.state.set(this.defaultState());
      this.persist();
      return;
    }
    try {
      const parsed = JSON.parse(raw) as DialogState;
      const next = this.normalizeState(parsed);
      this.state.set(next);
    } catch {
      this.state.set(this.defaultState());
    }
  }

  private persist() {
    this.persistQueued = true;
    this.schedulePersistFlush(Math.max(120, this.persistBackoffMs));
  }

  private schedulePersistFlush(delayMs = 0) {
    if (typeof window === 'undefined') {
      void this.flushPersist();
      return;
    }
    if (this.persistFlushTimer) {
      if (delayMs <= 0) return;
      window.clearTimeout(this.persistFlushTimer);
      this.persistFlushTimer = null;
    }
    this.persistFlushTimer = window.setTimeout(() => {
      this.persistFlushTimer = null;
      void this.flushPersist();
    }, delayMs);
  }

  private async flushPersist() {
    if (this.persistInFlight) return;
    if (!this.persistQueued) return;
    this.persistInFlight = true;
    try {
      while (this.persistQueued) {
        this.persistQueued = false;
        const userKey = this.userStorageKey();
        const payload = JSON.stringify(this.serializableState(this.state()));
        this.emitSystemEvent('PersistFlushStarted', {
          key: userKey,
          queued: this.persistQueued,
          backoffMs: this.persistBackoffMs,
        });
        try {
          await this.storage.setItem(userKey, payload);
          this.emitSystemEvent('PersistFlushCompleted', { key: userKey });
          this.persistBackoffMs = 0;
          this.persistConflictStreak = 0;
        } catch (error) {
          if (isRemoteStorageTooManyRequests(error)) {
            // API Gateway throttling during long drags: back off and coalesce the latest state.
            this.persistBackoffMs = Math.min(Math.max(this.persistBackoffMs || 200, 200) * 2, 2000);
            this.emitSystemEvent('PersistFlushThrottled', {
              key: userKey,
              nextBackoffMs: this.persistBackoffMs,
            });
            this.persistQueued = true;
            this.schedulePersistFlush(this.persistBackoffMs);
            break;
          }
          if (isRemoteStorageVersionConflict(error)) {
            const conflictPolicy = getKeySpaceConflictPolicy(userKey);
            if (conflictPolicy.ignoreVersionConflict) {
              this.emitSystemEvent('ConflictIgnored', {
                key: userKey,
                strategy: conflictPolicy.strategy,
              });
              break;
            }
            this.persistConflictStreak += 1;
            if (this.persistConflictStreak > conflictPolicy.maxRetries) {
              this.emitSystemEvent('ConflictDeferred', {
                key: userKey,
                strategy: conflictPolicy.strategy,
                attempts: this.persistConflictStreak,
              });
              this.persistConflictStreak = 0;
              break;
            }
            // Refresh adapter version cache and retry with bounded backoff.
            this.emitSystemEvent('ConflictResolved', {
              key: userKey,
              strategy: conflictPolicy.strategy,
            });
            try {
              await this.storage.getItem(userKey);
            } catch {
              // Ignore refresh failures; polling/realtime may catch up.
            }
            this.persistQueued = true;
            const delay = Math.max(
              conflictPolicy.baseRetryDelayMs,
              conflictPolicy.baseRetryDelayMs * this.persistConflictStreak,
            );
            this.schedulePersistFlush(delay);
            break;
          }
          // Avoid unhandled rejections from async persistence; keep app usable.
          console.error(error);
        }
      }
    } finally {
      this.persistInFlight = false;
      if (this.persistQueued && !this.persistFlushTimer) {
        this.schedulePersistFlush();
      }
    }
  }

  private userStorageKey() {
    const base =
      this.auth.isPreviewing() && !this.auth.previewPersist() ? PREVIEW_STATE_KEY : STATE_KEY;
    const userKey = this.auth.storageUserKey();
    return `${base}:${userKey}`;
  }

  private legacyUserStorageKey() {
    const base =
      this.auth.isPreviewing() && !this.auth.previewPersist() ? PREVIEW_STATE_KEY : STATE_KEY;
    const session = this.auth.session();
    const userId = session.previewUserId ?? session.userId ?? null;
    if (!userId) return null;
    return `${base}:${userId}`;
  }

  resetForUser(userId: string) {
    this.keys()
      .filter((key) => key.startsWith(`${STATE_KEY}:${userId}`))
      .forEach((key) => this.removeKey(key));
    this.keys()
      .filter((key) => key.startsWith(`${PREVIEW_STATE_KEY}:${userId}`))
      .forEach((key) => this.removeKey(key));
    const activeUser = this.auth.currentUser()?.id ?? this.auth.actualUser()?.id;
    if (activeUser === userId) {
      this.state.set(this.defaultState());
      this.persist();
    }
  }

  private getRaw(key: string) {
    return this.storage.getItemSync(key);
  }

  private setRaw(key: string, value: string) {
    void this.storage.setItem(key, value);
  }

  private removeKey(key: string) {
    void this.storage.removeItem(key);
  }

  private keys() {
    return this.storage.keysSync();
  }

  private emitSystemEvent(type: string, payload: unknown) {
    const universeId = this.currentUniverseId();
    if (!universeId) return;
    this.eventHub.publishSystem(universeId, type, payload, { agent: 'dialog-service' });
  }

  private currentUniverseId() {
    const key = this.auth.storageUserKey();
    const parts = key.split(':');
    return parts.length >= 2 ? parts[1] : null;
  }

  private defaultState(): DialogState {
    const workspaceId = this.uid('ws');
    return {
      workspaces: [{ id: workspaceId, name: 'Workspace 1' }],
      activeWorkspaceId: workspaceId,
      dialogsByWorkspace: { [workspaceId]: [] },
      hiddenWorkspaces: {},
      zCounter: 0,
      appCounters: {},
    };
  }

  private uid(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private normalizeState(state: DialogState): DialogState {
    const dialogsByWorkspace: Record<string, DialogInstance[]> = {};
    const appCounters: Partial<Record<AppId, number>> = { ...(state.appCounters ?? {}) };
    Object.entries(state.dialogsByWorkspace ?? {}).forEach(([workspaceId, dialogs]) => {
      dialogsByWorkspace[workspaceId] = dialogs.map((instance) => ({
        ...instance,
        titleKey: instance.titleKey ?? APP_REGISTRY[instance.appId]?.labelKey ?? 'apps.todo',
        titleOverride: instance.titleOverride ?? undefined,
        instanceNumber:
          instance.instanceNumber ??
          (() => {
            const next = (appCounters[instance.appId] ?? 0) + 1;
            appCounters[instance.appId] = next;
            return next;
          })(),
        stashed: instance.stashed ?? false,
        archived: instance.archived ?? false,
        tileRect: instance.tileRect,
        // Phone UI state is device-local UX state and should not be hydrated from shared storage.
        phoneRect: undefined,
        phoneMinimized: false,
        phoneStashed: false,
        phoneTileRect: undefined,
        phoneRestoreRect: undefined,
        phoneMaximized: false,
        deleteLocked: instance.deleteLocked ?? false,
      }));
      dialogsByWorkspace[workspaceId].forEach((instance) => {
        if (instance.instanceNumber !== undefined) {
          appCounters[instance.appId] = Math.max(
            appCounters[instance.appId] ?? 0,
            instance.instanceNumber,
          );
        }
      });
    });
    return {
      ...state,
      dialogsByWorkspace,
      workspaces: state.workspaces?.length ? state.workspaces : this.defaultState().workspaces,
      activeWorkspaceId: state.activeWorkspaceId || this.defaultState().activeWorkspaceId,
      hiddenWorkspaces: state.hiddenWorkspaces ?? {},
      zCounter: state.zCounter ?? 0,
      appCounters,
    };
  }

  private serializableState(state: DialogState): DialogState {
    const dialogsByWorkspace: Record<string, DialogInstance[]> = {};
    for (const [workspaceId, dialogs] of Object.entries(state.dialogsByWorkspace ?? {})) {
      dialogsByWorkspace[workspaceId] = dialogs.map((instance) => ({
        ...instance,
        phoneRect: undefined,
        phoneMinimized: false,
        phoneStashed: false,
        phoneTileRect: undefined,
        phoneRestoreRect: undefined,
        phoneMaximized: false,
      }));
    }
    return { ...state, dialogsByWorkspace };
  }
}
