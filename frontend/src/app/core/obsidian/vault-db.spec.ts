import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { VaultDbService } from './vault-db';
import { StorageService } from '../storage/storage.service';
import { STORAGE_ADAPTER } from '../storage/storage-adapter';
import { LocalStorageAdapter } from '../storage/local-storage.adapter';
import { AuthService } from '../auth.service';

class MockAuthService {
  guestModeOnly() {
    return false;
  }
  usesExternalAuth() {
    return true;
  }
  isLoggedIn() {
    return true;
  }
  session() {
    return { userId: 'u_test' };
  }
  orgSettings() {
    return { testModeEnabled: false };
  }
}

describe('VaultDbService', () => {
  let service: VaultDbService;

  beforeEach(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('operator-obsidian-vaults');
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });

    await TestBed.configureTestingModule({
      providers: [
        VaultDbService,
        StorageService,
        { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter },
        { provide: AuthService, useClass: MockAuthService },
      ],
    }).compileComponents();

    service = TestBed.inject(VaultDbService);
    await TestBed.inject(StorageService).hydrate();
  });

  it('clones markdown files with shared content refs in cow mode and materializes on edit', async () => {
    const vault = await service.createVault('Test Vault', {
      type: 'zip',
      originalName: 'test.zip',
    });
    await service.putNodes([
      { id: 'f_root', vaultId: vault.id, path: 'Folder', type: 'folder' },
      { id: 'n1', vaultId: vault.id, path: 'Folder/Note.md', type: 'file', parentId: 'f_root' },
    ]);
    await service.putMarkdownFiles([
      {
        nodeId: 'n1',
        vaultId: vault.id,
        content: '# Hello',
        updatedAt: Date.now(),
        hash: 'hash_hello',
      },
    ]);

    const clone = await service.cloneVault(vault.id, { mode: 'cow', name: 'Clone Vault' });
    const [originalMd] = await service.listMarkdownFiles(vault.id);
    const [cloneMd] = await service.listMarkdownFiles(clone.id);

    expect(originalMd.content).toBe('# Hello');
    expect(cloneMd.content).toBe('# Hello');
    expect(originalMd.contentRefId).toBeTruthy();
    expect(cloneMd.contentRefId).toBeTruthy();
    expect(cloneMd.contentRefId).toBe(originalMd.contentRefId);

    const cloneNode = (await service.listNodes(clone.id)).find((n) => /Note\.md$/i.test(n.path));
    expect(cloneNode).toBeTruthy();

    await service.saveMarkdownFile(cloneNode!.id, '# Changed clone');
    const [originalAfter] = await service.listMarkdownFiles(vault.id);
    const [cloneAfter] = await service.listMarkdownFiles(clone.id);
    expect(originalAfter.content).toBe('# Hello');
    expect(cloneAfter.content).toBe('# Changed clone');
    expect(cloneAfter.contentRefId).not.toBe(originalAfter.contentRefId);
  });
});
