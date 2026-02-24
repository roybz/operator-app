import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotesComponent } from './notes.component';
import { AppPreferencesService } from '../../../dependencies/app-preferences.service';
import { InstanceSettingsService } from '../../../../core/instance-settings.service';
import { ImportGuardService } from '../../../../core/import-guard.service';
import { ExportGuardService } from '../../../../core/export-guard.service';
import { STORAGE_ADAPTER } from '../../../../core/storage/storage-adapter';
import { LocalStorageAdapter } from '../../../../core/storage/local-storage.adapter';
import { StorageService } from '../../../../core/storage/storage.service';
import { RemoteConflictService } from '../../../../core/realtime/remote-conflict.service';
import { ObsidianImportService } from '../../../../core/obsidian/obsidian-import.service';
import { VaultDbService } from '../../../../core/obsidian/vault-db';
import { DialogService } from '../../../../core/dialog.service';
import { UserPreferences } from '../../../../core/auth.service';
import { VaultFileTreeNode } from '../../../../core/obsidian/vault-types';
import { TranslateService } from '@ngx-translate/core';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

class MockPrefsService {
  preferences() {
    return { phoneMode: false } as UserPreferences;
  }
  userId() {
    return 'u_test';
  }
}

class MockInstanceSettingsService {
  isOpen() {
    return false;
  }
  close() {
    // no-op
  }
}

class MockImportGuardService {
  start() {
    return true;
  }
  finish() {
    // no-op
  }
}

class MockExportGuardService {
  start() {
    return true;
  }
  finish() {
    // no-op
  }
}

class MockRemoteConflictService {
  markDirty() {
    // no-op
  }
  clearDirty() {
    // no-op
  }
  queue() {
    // no-op
  }
}

class MockObsidianImportService {}

class MockDialogService {
  createInstance() {
    return { ok: true, instance: { id: 'new_notes' } };
  }
  setTitleOverride() {
    // no-op
  }
}

class MockVaultDbService {
  private unresolved = [
    { id: 'l1', vaultId: 'v1', fromNodeId: 'f1', rawTarget: 'Missing', type: 'wikilink' as const },
  ];
  canUseCloudVaultSyncBeta() {
    return true;
  }
  async ensureVaultAvailable() {
    return true;
  }
  async getVault() {
    return {
      id: 'v1',
      name: 'Vault',
      createdAt: Date.now(),
      source: { type: 'zip' },
      cloudBeta: null,
    };
  }
  async getTree(): Promise<VaultFileTreeNode[]> {
    const children: VaultFileTreeNode[] = [];
    for (let i = 0; i < 500; i += 1) {
      children.push({ id: `f${i}`, path: `Folder/Note${i}.md`, name: `Note${i}.md`, type: 'file' });
    }
    return [{ id: 'folder', path: 'Folder', name: 'Folder', type: 'folder', children }];
  }
  async getMarkdownFile(nodeId: string) {
    return {
      nodeId,
      vaultId: 'v1',
      content: '# test',
      updatedAt: Date.now(),
      hash: 'h',
      contentRefId: 'r1',
    };
  }
  async getNode(nodeId: string) {
    return { id: nodeId, vaultId: 'v1', path: `Folder/${nodeId}.md`, type: 'file' as const };
  }
  async listAssets() {
    return [];
  }
  async getAssetUrl() {
    return null;
  }
  async getNodeByPath() {
    return undefined;
  }
  async listUnresolvedLinks() {
    return this.unresolved;
  }
  async saveMarkdownFile() {
    return { record: null, previous: null };
  }
  async cloneVault() {
    return { id: 'v2', name: 'Vault copy' };
  }
  async setVaultCloudBetaEnabled() {
    return true;
  }
  async setVaultCloudAttachmentsBetaRequested() {
    return true;
  }
  async getVaultCloudBetaSummary() {
    return { cloudEnabled: false, syncedMarkdownOnly: true, counts: { assets: 0 }, assetBytes: 0 };
  }
  async createMarkdownNoteByPath() {
    return { id: 'created_note', vaultId: 'v1', path: 'Created.md', type: 'file' as const };
  }
  async resolveLinkTarget() {
    return true;
  }
}

describe('NotesComponent (vault mode)', () => {
  let fixture: ComponentFixture<NotesComponent>;
  let component: NotesComponent;
  let vaultDb: MockVaultDbService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotesComponent],
      providers: [
        { provide: AppPreferencesService, useClass: MockPrefsService },
        { provide: InstanceSettingsService, useClass: MockInstanceSettingsService },
        { provide: ImportGuardService, useClass: MockImportGuardService },
        { provide: ExportGuardService, useClass: MockExportGuardService },
        { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter },
        { provide: RemoteConflictService, useClass: MockRemoteConflictService },
        { provide: ObsidianImportService, useClass: MockObsidianImportService },
        { provide: VaultDbService, useClass: MockVaultDbService },
        { provide: DialogService, useClass: MockDialogService },
        {
          provide: TranslateService,
          useValue: {
            instant: (key: string) => key,
            get: (key: string) => of(key),
            stream: (key: string) => of(key),
            currentLang: 'en',
            onLangChange: new Subject(),
            onTranslationChange: new Subject(),
            onDefaultLangChange: new Subject(),
          },
        },
      ],
    }).compileComponents();

    await TestBed.inject(StorageService).hydrate();
    vaultDb = TestBed.inject(VaultDbService) as unknown as MockVaultDbService;

    fixture = TestBed.createComponent(NotesComponent);
    component = fixture.componentInstance;
    component.instanceId = 'notes-vault-test';
    fixture.detectChanges();
  });

  it('loads vault tree and unresolved links in vault mode', async () => {
    component.state.set({
      ...component.state(),
      source: { type: 'vault', vaultId: 'v1', vaultName: 'Vault' },
      vaultSelectedNodeId: null,
    });

    await component.refreshVaultTree();

    expect(component.vaultTree().length).toBe(1);
    expect(component.vaultUnresolvedLinks().length).toBe(1);
    expect(component.vaultVisibleRows().length).toBeGreaterThan(0);
    expect(component.vaultVisibleRows().length).toBeLessThan(component.vaultFlatRows().length);
  });

  it('updates virtualized visible rows when scrolled', async () => {
    component.state.set({
      ...component.state(),
      source: { type: 'vault', vaultId: 'v1', vaultName: 'Vault' },
      vaultSelectedNodeId: null,
    });
    await component.refreshVaultTree();

    const beforeFirst = component.vaultVisibleRows()[0]?.id;
    component.onVaultTreeScroll({
      target: { scrollTop: 600, clientHeight: 200 },
    } as unknown as Event);
    const afterFirst = component.vaultVisibleRows()[0]?.id;

    expect(afterFirst).toBeTruthy();
    expect(afterFirst).not.toBe(beforeFirst);
  });

  it('creates missing note target from unresolved link and selects it', async () => {
    const createSpy = vi.spyOn(vaultDb, 'createMarkdownNoteByPath');
    const relinkSpy = vi.spyOn(vaultDb, 'resolveLinkTarget');
    const selectSpy = vi.spyOn(component, 'selectVaultNode').mockResolvedValue();
    component.state.set({
      ...component.state(),
      source: { type: 'vault', vaultId: 'v1', vaultName: 'Vault' },
      vaultSelectedNodeId: null,
    });
    await component.refreshVaultTree();

    await component.createNoteForUnresolvedLink(component.vaultUnresolvedLinks()[0]!);

    expect(createSpy).toHaveBeenCalledWith('v1', 'Missing', '');
    expect(relinkSpy).toHaveBeenCalledWith('l1', 'Created.md');
    expect(selectSpy).toHaveBeenCalledWith('created_note');
  });

  it('persists attachment cloud beta request flag for current vault', async () => {
    const setSpy = vi.spyOn(vaultDb, 'setVaultCloudAttachmentsBetaRequested');
    component.state.set({
      ...component.state(),
      source: { type: 'vault', vaultId: 'v1', vaultName: 'Vault' },
      vaultSelectedNodeId: null,
    });

    await component.toggleCurrentVaultCloudAttachmentsBetaRequested(true);

    expect(setSpy).toHaveBeenCalledWith('v1', true);
  });
});
