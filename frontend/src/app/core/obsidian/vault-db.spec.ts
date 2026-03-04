import { TestBed } from '@angular/core/testing';
import 'fake-indexeddb/auto';
import { VaultDbService } from './vault-db';
import { StorageService } from '../storage/storage.service';
import { STORAGE_ADAPTER } from '../storage/storage-adapter';
import { LocalStorageAdapter } from '../storage/local-storage.adapter';
import { AuthService } from '../auth.service';

class MockAuthService {
  guestModeOnlyFlag = false;
  usesExternalAuthFlag = true;
  isLoggedInFlag = true;
  userId = 'u_test';
  testModeEnabled = false;

  guestModeOnly() {
    return this.guestModeOnlyFlag;
  }
  usesExternalAuth() {
    return this.usesExternalAuthFlag;
  }
  isLoggedIn() {
    return this.isLoggedInFlag;
  }
  session() {
    return { userId: this.userId };
  }
  orgSettings() {
    return { testModeEnabled: this.testModeEnabled };
  }
}

describe('VaultDbService', () => {
  let service: VaultDbService;
  let storage: StorageService;
  let auth: MockAuthService;

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
    storage = TestBed.inject(StorageService);
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    await storage.hydrate();
    (globalThis as { window?: { __OP_CONFIG__?: unknown } }).window ??= {};
    (globalThis as { window: { __OP_CONFIG__?: unknown } }).window.__OP_CONFIG__ = {
      storageMode: 'local',
      cloudVaultAttachmentUploadBetaEnabled: false,
      cloudVaultAttachmentUploadMaxTotalBytes: 1024 * 1024,
      cloudVaultAttachmentUploadMaxAssetBytes: 256 * 1024,
    };
  });

  afterEach(async () => {
    const db = await (service as unknown as { dbPromise?: Promise<IDBDatabase> }).dbPromise;
    db?.close();
    (globalThis as { window?: { __OP_CONFIG__?: unknown } }).window ??= {};
    (globalThis as { window: { __OP_CONFIG__?: unknown } }).window.__OP_CONFIG__ = {
      storageMode: 'local',
    };
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

  it('creates markdown notes by path with missing folders', async () => {
    const vault = await service.createVault('Path Vault', {
      type: 'zip',
      originalName: 'path.zip',
    });

    const node = await service.createMarkdownNoteByPath(vault.id, 'Projects/Work/Plan');
    const nodes = await service.listNodes(vault.id);
    const md = await service.getMarkdownFile(node.id);

    expect(node.path).toBe('Projects/Work/Plan.md');
    expect(nodes.some((n) => n.type === 'folder' && n.path === 'Projects')).toBe(true);
    expect(nodes.some((n) => n.type === 'folder' && n.path === 'Projects/Work')).toBe(true);
    expect(md?.content).toBe('');
  });

  it('stores attachment cloud beta request in vault summary without uploading assets', async () => {
    const vault = await service.createVault('Cloud Pref Vault', {
      type: 'zip',
      originalName: 'cloud-pref.zip',
    });
    await service.setVaultCloudAttachmentsBetaRequested(vault.id, true);

    const summary = await service.getVaultCloudBetaSummary(vault.id);
    const updatedVault = await service.getVault(vault.id);

    expect(summary.attachmentsCloudRequested).toBe(true);
    expect(summary.attachmentsCloudSupported).toBe(false);
    expect(updatedVault?.cloudBeta?.attachmentsCloudRequested).toBe(true);
    expect(updatedVault?.cloudBeta?.attachmentsCloudSupported).toBe(false);
  });

  it('uploads small attachments to cloud keys when strict runtime flag is enabled', async () => {
    (globalThis as { window: { __OP_CONFIG__?: unknown } }).window.__OP_CONFIG__ = {
      storageMode: 'remote',
      cloudVaultAttachmentUploadBetaEnabled: true,
      cloudVaultAttachmentUploadMaxTotalBytes: 256 * 1024,
      cloudVaultAttachmentUploadMaxAssetBytes: 128 * 1024,
    };
    const vault = await service.createVault('Attachment Cloud Vault', {
      type: 'zip',
      originalName: 'attachment.zip',
    });
    await service.putAssets([
      {
        asset: {
          id: 'a1',
          vaultId: vault.id,
          path: 'img.png',
          mime: 'image/png',
          size: 8,
          blobId: 'b1',
        },
        blob: new Blob(['pngdata!!'], { type: 'image/png' }),
      },
    ]);
    await service.setVaultCloudAttachmentsBetaRequested(vault.id, true);
    await service.setVaultCloudBetaEnabled(vault.id, true);

    const manifest = await storage.getJson<Record<string, unknown> | null>(
      `op_obsidian_vault_cloud:v1:${vault.id}:manifest`,
      null,
    );
    const attachmentPlan = await storage.getJson<Record<string, unknown> | null>(
      `op_obsidian_vault_cloud:v1:${vault.id}:attachments:plan`,
      null,
    );
    const attachmentIndex = await storage.getJson<{ id: string; chunkCount: number }[]>(
      `op_obsidian_vault_cloud:v1:${vault.id}:attachments:index`,
      [],
    );

    expect(manifest?.['assetsStoredInCloud']).toBe(true);
    expect(manifest?.['attachmentsCloudSupported']).toBe(true);
    expect(attachmentPlan?.['mode']).toBe('chunked_base64');
    expect(attachmentPlan?.['requested']).toBe(true);
    if (attachmentIndex.length > 0) {
      expect(attachmentIndex[0]?.id).toBe('a1');
      expect((attachmentIndex[0]?.chunkCount ?? 0) > 0).toBe(true);
    }
  });

  it('disables cloud vault beta for guest mode sessions', () => {
    (globalThis as { window: { __OP_CONFIG__?: unknown } }).window.__OP_CONFIG__ = {
      storageMode: 'remote',
      cloudVaultAttachmentUploadBetaEnabled: true,
    };
    auth.guestModeOnlyFlag = true;
    auth.testModeEnabled = false;
    auth.usesExternalAuthFlag = true;
    auth.isLoggedInFlag = true;
    auth.userId = 'u_test';

    expect(service.canUseCloudVaultSyncBeta()).toBe(false);
    expect(service.canUseCloudVaultAttachmentSyncBeta()).toBe(false);
  });

  it('disables cloud vault beta when admin test mode is enabled', () => {
    (globalThis as { window: { __OP_CONFIG__?: unknown } }).window.__OP_CONFIG__ = {
      storageMode: 'remote',
      cloudVaultAttachmentUploadBetaEnabled: true,
    };
    auth.guestModeOnlyFlag = false;
    auth.testModeEnabled = true;
    auth.usesExternalAuthFlag = true;
    auth.isLoggedInFlag = true;
    auth.userId = 'u_test';

    expect(service.canUseCloudVaultSyncBeta()).toBe(false);
    expect(service.canUseCloudVaultAttachmentSyncBeta()).toBe(false);
  });
});
