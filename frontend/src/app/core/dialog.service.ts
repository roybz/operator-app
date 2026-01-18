import { Injectable, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

export type AppId = 'todo' | 'calculator' | 'timer' | 'navigator' | 'notes';

export interface DialogRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DialogInstance {
  id: string;
  appId: AppId;
  titleKey: string;
  titleOverride?: string;
  rect: DialogRect;
  minimized: boolean;
  stashed: boolean;
  tileRect?: DialogRect;
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
}

const STATE_KEY = 'op_dialog_state_v1';
const PREVIEW_STATE_KEY = 'op_preview_dialog_state_v1';

const APP_CONFIG: Record<AppId, { titleKey: string; defaultSize: DialogRect }> = {
  todo: { titleKey: 'apps.todo', defaultSize: { x: 0, y: 0, width: 480, height: 640 } },
  calculator: { titleKey: 'apps.calculator', defaultSize: { x: 0, y: 0, width: 320, height: 480 } },
  timer: { titleKey: 'apps.timer', defaultSize: { x: 0, y: 0, width: 420, height: 520 } },
  navigator: { titleKey: 'apps.navigator', defaultSize: { x: 0, y: 0, width: 720, height: 520 } },
  notes: { titleKey: 'apps.notes', defaultSize: { x: 0, y: 0, width: 700, height: 600 } },
};
const TILE_SIZE = { width: 180, height: 80 };

@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly state = signal<DialogState>(this.defaultState());

  readonly workspaces = this.state.asReadonly();

  private auth = inject(AuthService);

  constructor() {
    effect(() => {
      const session = this.auth.session();
      if (!session.userId && !session.previewUserId) {
        this.state.set(this.defaultState());
        return;
      }
      this.load();
    });
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

  getAppInstances(appId: AppId) {
    return this.getActiveDialogs().filter((instance) => instance.appId === appId);
  }

  addWorkspace() {
    const workspaces = this.state().workspaces;
    if (workspaces.length >= 5) return false;
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

    const config = APP_CONFIG[appId];
    const rect = this.centerRect(config.defaultSize, bounds);
    const instance: DialogInstance = {
      id: this.uid('dlg'),
      appId,
      titleKey: config.titleKey,
      rect,
      minimized: false,
      stashed: false,
      tileRect: undefined,
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
      dialogsByWorkspace: { ...this.state().dialogsByWorkspace, [workspaceId]: nextDialogs },
    });
    this.persist();
    return { ok: true, instance };
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

  stashInstance(instanceId: string, bounds: DOMRect) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      stashed: true,
      minimized: false,
      tileRect: this.createTileRect(instance, bounds),
    }));
  }

  moveTile(instanceId: string, rect: Partial<DialogRect>, bounds: DOMRect) {
    this.updateInstance(instanceId, (instance) => ({
      ...instance,
      tileRect: instance.tileRect
        ? this.clampTileRect({ ...instance.tileRect, ...rect }, bounds)
        : this.createTileRect(instance, bounds),
    }));
  }

  unstashInstance(instanceId: string) {
    this.updateInstance(instanceId, (instance) => ({ ...instance, stashed: false }));
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

    if (typeof window !== 'undefined' && appId === 'todo') {
      removedIds.forEach((id) => {
        window.localStorage.removeItem(`op_mock_todos:${id}`);
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

  resetPositions(mode: 'left' | 'middle', bounds: DOMRect) {
    const workspaceId = this.getActiveWorkspaceId();
    const dialogs = this.getDialogsForWorkspace(workspaceId);
    const nextDialogs = dialogs.map((instance) => {
      if (instance.stashed) return instance;
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

  private createTileRect(instance: DialogInstance, bounds: DOMRect): DialogRect {
    const centerX = instance.rect.x + instance.rect.width / 2 - TILE_SIZE.width / 2;
    const centerY = instance.rect.y + instance.rect.height / 2 - TILE_SIZE.height / 2;
    return {
      x: Math.min(Math.max(centerX, 0), Math.max(0, bounds.width - TILE_SIZE.width)),
      y: Math.min(Math.max(centerY, 0), Math.max(0, bounds.height - TILE_SIZE.height)),
      width: TILE_SIZE.width,
      height: TILE_SIZE.height,
    };
  }

  private clampTileRect(rect: DialogRect, bounds: DOMRect): DialogRect {
    const width = TILE_SIZE.width;
    const height = TILE_SIZE.height;
    const x = Math.min(Math.max(rect.x, 0), Math.max(0, bounds.width - width));
    const y = Math.min(Math.max(rect.y, 0), Math.max(0, bounds.height - height));
    return { x, y, width, height };
  }

  private load() {
    if (typeof window === 'undefined') return;
    const userKey = this.userStorageKey();
    const raw = window.localStorage.getItem(userKey);
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
    if (typeof window === 'undefined') return;
    const userKey = this.userStorageKey();
    window.localStorage.setItem(userKey, JSON.stringify(this.state()));
  }

  private userStorageKey() {
    const base =
      this.auth.isPreviewing() && !this.auth.previewPersist() ? PREVIEW_STATE_KEY : STATE_KEY;
    const userId = this.auth.currentUser()?.id ?? this.auth.actualUser()?.id ?? 'anon';
    return `${base}:${userId}`;
  }

  private defaultState(): DialogState {
    const workspaceId = this.uid('ws');
    return {
      workspaces: [{ id: workspaceId, name: 'Workspace 1' }],
      activeWorkspaceId: workspaceId,
      dialogsByWorkspace: { [workspaceId]: [] },
      hiddenWorkspaces: {},
      zCounter: 0,
    };
  }

  private uid(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private normalizeState(state: DialogState): DialogState {
    const dialogsByWorkspace: Record<string, DialogInstance[]> = {};
    Object.entries(state.dialogsByWorkspace ?? {}).forEach(([workspaceId, dialogs]) => {
      dialogsByWorkspace[workspaceId] = dialogs.map((instance) => ({
        ...instance,
        titleKey: instance.titleKey ?? APP_CONFIG[instance.appId]?.titleKey ?? 'apps.todo',
        titleOverride: instance.titleOverride ?? undefined,
        stashed: instance.stashed ?? false,
        tileRect: instance.tileRect,
        deleteLocked: instance.deleteLocked ?? false,
      }));
    });
    return {
      ...state,
      dialogsByWorkspace,
      workspaces: state.workspaces?.length ? state.workspaces : this.defaultState().workspaces,
      activeWorkspaceId: state.activeWorkspaceId || this.defaultState().activeWorkspaceId,
      hiddenWorkspaces: state.hiddenWorkspaces ?? {},
      zCounter: state.zCounter ?? 0,
    };
  }
}
