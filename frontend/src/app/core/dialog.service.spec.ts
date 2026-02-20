import { TestBed } from '@angular/core/testing';
import { TranslateFakeLoader, TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { AuthService } from './auth.service';
import { DialogService } from './dialog.service';
import { STORAGE_ADAPTER } from './storage/storage-adapter';
import { LocalStorageAdapter } from './storage/local-storage.adapter';
import { StorageService } from './storage/storage.service';

describe('DialogService', () => {
  const bounds = new DOMRect(0, 0, 1280, 800);

  beforeEach(async () => {
    window.localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [
        TranslateModule.forRoot({
          loader: { provide: TranslateLoader, useClass: TranslateFakeLoader },
        }),
      ],
      providers: [{ provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter }],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();
    const auth = TestBed.inject(AuthService);
    await auth.hydrate();
    auth.loginAsGuest();
  });

  it('supports add, switch, rename, and reorder workspace flows', () => {
    const dialog = TestBed.inject(DialogService);
    const firstId = dialog.getActiveWorkspaceId();

    const added = dialog.addWorkspace();
    expect(added).toBe(true);
    expect(dialog.getWorkspaces().length).toBe(2);

    const second = dialog.getWorkspaces().find((ws) => ws.id !== firstId);
    expect(second).toBeTruthy();
    if (!second) return;

    dialog.switchWorkspace(second.id);
    expect(dialog.getActiveWorkspaceId()).toBe(second.id);

    dialog.renameWorkspace(second.id, '  Ops  ');
    expect(dialog.getWorkspaces().find((ws) => ws.id === second.id)?.name).toBe('Ops');

    dialog.reorderWorkspaceToIndex(second.id, 0);
    expect(dialog.getWorkspaces()[0].id).toBe(second.id);
  });

  it('moves an instance between workspaces', () => {
    const dialog = TestBed.inject(DialogService);
    const firstId = dialog.getActiveWorkspaceId();
    dialog.addWorkspace();
    const second = dialog.getWorkspaces().find((ws) => ws.id !== firstId);
    expect(second).toBeTruthy();
    if (!second) return;

    const created = dialog.createInstance('todo', bounds);
    expect(created.ok).toBe(true);
    if (!created.ok || !created.instance) return;

    dialog.moveInstanceToWorkspace(created.instance.id, second.id);

    expect(dialog.findWorkspaceForInstance(created.instance.id)).toBe(second.id);
    expect(dialog.getDialogsForWorkspace(firstId).some((d) => d.id === created.instance.id)).toBe(
      false,
    );
    expect(dialog.getDialogsForWorkspace(second.id).some((d) => d.id === created.instance.id)).toBe(
      true,
    );
  });

  it('closes active workspace by moving dialogs to remaining workspace in minimized state', () => {
    const dialog = TestBed.inject(DialogService);
    const firstId = dialog.getActiveWorkspaceId();
    dialog.addWorkspace();
    const second = dialog.getWorkspaces().find((ws) => ws.id !== firstId);
    expect(second).toBeTruthy();
    if (!second) return;

    dialog.switchWorkspace(second.id);
    const created = dialog.createInstance('todo', bounds);
    expect(created.ok).toBe(true);
    if (!created.ok || !created.instance) return;

    const closed = dialog.closeWorkspace(second.id);
    expect(closed).toBe(true);
    expect(dialog.getActiveWorkspaceId()).toBe(firstId);

    const moved = dialog.getDialogsForWorkspace(firstId).find((d) => d.id === created.instance.id);
    expect(moved).toBeTruthy();
    expect(moved?.minimized).toBe(true);
  });

  it('filters archived app instances when includeArchived is false', () => {
    const dialog = TestBed.inject(DialogService);
    const created = dialog.createInstance('todo', bounds);
    expect(created.ok).toBe(true);
    if (!created.ok || !created.instance) return;

    dialog.archiveInstance(created.instance.id);

    expect(dialog.getAppInstances('todo').length).toBe(1);
    expect(dialog.getAppInstances('todo', { includeArchived: false }).length).toBe(0);
  });
});
