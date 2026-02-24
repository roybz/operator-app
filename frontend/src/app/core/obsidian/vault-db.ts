import { Injectable, inject } from '@angular/core';
import {
  AssetRecord,
  LinkIndexRecord,
  MarkdownFileRecord,
  ObsidianImportSourceType,
  VaultFileTreeNode,
  VaultNodeRecord,
  VaultRecord,
} from './vault-types';
import { parseObsidianMarkdown, resolveObsidianLinkTarget } from './obsidian-parse';
import { StorageService } from '../storage/storage.service';
import { AuthService } from '../auth.service';
import { getOpConfig } from '../op-config';

const DB_NAME = 'operator-obsidian-vaults';
const DB_VERSION = 3;
const CLOUD_VAULT_PREFIX = 'op_obsidian_vault_cloud:v1';
const CLOUD_CHUNK_TARGET_BYTES = 220 * 1024;

const STORES = {
  vaults: 'vaults',
  nodes: 'vault_nodes',
  markdown: 'vault_markdown',
  markdownContent: 'vault_markdown_content',
  assets: 'vault_assets',
  blobs: 'vault_asset_blobs',
  links: 'vault_links',
} as const;

type StoredMarkdownFileRecord = Omit<MarkdownFileRecord, 'content'> & {
  content?: string;
  contentRefId?: string | null;
};

function reqToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

function txDone(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
  });
}

function uid(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

@Injectable({ providedIn: 'root' })
export class VaultDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private assetUrlCache = new Map<string, string>();
  private storage = inject(StorageService);
  private auth = inject(AuthService);
  private cloudSyncInflight = new Map<string, Promise<void>>();

  private openDb() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        const ensureIndex = (
          store: IDBObjectStore,
          name: string,
          keyPath: string | string[],
          unique = false,
        ) => {
          if (!store.indexNames.contains(name)) {
            store.createIndex(name, keyPath, { unique });
          }
        };
        if (!db.objectStoreNames.contains(STORES.vaults)) {
          db.createObjectStore(STORES.vaults, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.nodes)) {
          const store = db.createObjectStore(STORES.nodes, { keyPath: 'id' });
          ensureIndex(store, 'byVaultId', 'vaultId');
          ensureIndex(store, 'byVaultPath', ['vaultId', 'path'], true);
        } else {
          const store = request.transaction?.objectStore(STORES.nodes);
          if (store) {
            ensureIndex(store, 'byVaultId', 'vaultId');
            ensureIndex(store, 'byVaultPath', ['vaultId', 'path'], true);
          }
        }
        if (!db.objectStoreNames.contains(STORES.markdown)) {
          const store = db.createObjectStore(STORES.markdown, { keyPath: 'nodeId' });
          ensureIndex(store, 'byVaultId', 'vaultId');
        } else {
          const store = request.transaction?.objectStore(STORES.markdown);
          if (store) ensureIndex(store, 'byVaultId', 'vaultId');
        }
        if (!db.objectStoreNames.contains(STORES.markdownContent)) {
          db.createObjectStore(STORES.markdownContent, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.assets)) {
          const store = db.createObjectStore(STORES.assets, { keyPath: 'id' });
          ensureIndex(store, 'byVaultId', 'vaultId');
          ensureIndex(store, 'byVaultPath', ['vaultId', 'path'], true);
        } else {
          const store = request.transaction?.objectStore(STORES.assets);
          if (store) {
            ensureIndex(store, 'byVaultId', 'vaultId');
            ensureIndex(store, 'byVaultPath', ['vaultId', 'path'], true);
          }
        }
        if (!db.objectStoreNames.contains(STORES.blobs)) {
          db.createObjectStore(STORES.blobs, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.links)) {
          const store = db.createObjectStore(STORES.links, { keyPath: 'id' });
          ensureIndex(store, 'byVaultId', 'vaultId');
          ensureIndex(store, 'byFromNodeId', 'fromNodeId');
        } else {
          const store = request.transaction?.objectStore(STORES.links);
          if (store) {
            ensureIndex(store, 'byVaultId', 'vaultId');
            ensureIndex(store, 'byFromNodeId', 'fromNodeId');
          }
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Unable to open IndexedDB'));
    });
    return this.dbPromise;
  }

  async createVault(
    name: string,
    source: { type: ObsidianImportSourceType; originalName?: string },
  ) {
    const db = await this.openDb();
    const record: VaultRecord = {
      id: uid('vault'),
      name,
      createdAt: Date.now(),
      source,
      cloneOfVaultId: null,
      cloudBeta: null,
    };
    const tx = db.transaction([STORES.vaults], 'readwrite');
    tx.objectStore(STORES.vaults).put(record);
    await txDone(tx);
    return record;
  }

  async getVault(vaultId: string) {
    const db = await this.openDb();
    const tx = db.transaction([STORES.vaults], 'readonly');
    return (await reqToPromise(tx.objectStore(STORES.vaults).get(vaultId))) as
      | VaultRecord
      | undefined;
  }

  async putVault(vault: VaultRecord) {
    const db = await this.openDb();
    const tx = db.transaction([STORES.vaults], 'readwrite');
    tx.objectStore(STORES.vaults).put(vault);
    await txDone(tx);
  }

  canUseCloudVaultSyncBeta() {
    const config = getOpConfig();
    if (config.storageMode !== 'remote') return false;
    if (this.auth.guestModeOnly()) return false;
    if (!this.auth.usesExternalAuth()) return false;
    if (!this.auth.isLoggedIn()) return false;
    if (this.auth.session().userId === 'u_guest') return false;
    if (this.auth.orgSettings().testModeEnabled) return false;
    return true;
  }

  async setVaultCloudBetaEnabled(vaultId: string, enabled: boolean) {
    const vault = await this.getVault(vaultId);
    if (!vault) return false;
    vault.cloudBeta = {
      enabled,
      lastSyncedAt: enabled ? (vault.cloudBeta?.lastSyncedAt ?? null) : null,
      lastSyncError: null,
      syncedMarkdownOnly: true,
      attachmentsCloudRequested: vault.cloudBeta?.attachmentsCloudRequested ?? false,
      attachmentsCloudSupported: false,
    };
    await this.putVault(vault);
    if (enabled) {
      await this.syncVaultToCloud(vaultId);
    }
    return true;
  }

  async setVaultCloudAttachmentsBetaRequested(vaultId: string, requested: boolean) {
    const vault = await this.getVault(vaultId);
    if (!vault) return false;
    vault.cloudBeta = {
      enabled: Boolean(vault.cloudBeta?.enabled),
      lastSyncedAt: vault.cloudBeta?.lastSyncedAt ?? null,
      lastSyncError: vault.cloudBeta?.lastSyncError ?? null,
      syncedMarkdownOnly: true,
      attachmentsCloudRequested: requested,
      attachmentsCloudSupported: false,
    };
    await this.putVault(vault);
    if (vault.cloudBeta.enabled) void this.syncVaultToCloud(vaultId);
    return true;
  }

  async ensureVaultAvailable(vaultId: string) {
    const local = await this.getVault(vaultId);
    if (local) return true;
    if (!this.canUseCloudVaultSyncBeta()) return false;
    return this.restoreVaultFromCloud(vaultId);
  }

  async listNodes(vaultId: string) {
    const db = await this.openDb();
    const tx = db.transaction([STORES.nodes], 'readonly');
    const index = tx.objectStore(STORES.nodes).index('byVaultId');
    return (await reqToPromise(index.getAll(vaultId))) as VaultNodeRecord[];
  }

  async listMarkdownFiles(vaultId: string) {
    const db = await this.openDb();
    const tx = db.transaction([STORES.markdown], 'readonly');
    const index = tx.objectStore(STORES.markdown).index('byVaultId');
    const rows = (await reqToPromise(index.getAll(vaultId))) as StoredMarkdownFileRecord[];
    return Promise.all(rows.map((row) => this.hydrateMarkdownRecord(row)));
  }

  async listLinks(vaultId: string) {
    const db = await this.openDb();
    const tx = db.transaction([STORES.links], 'readonly');
    const index = tx.objectStore(STORES.links).index('byVaultId');
    return (await reqToPromise(index.getAll(vaultId))) as LinkIndexRecord[];
  }

  async listAssets(vaultId: string) {
    const db = await this.openDb();
    const tx = db.transaction([STORES.assets], 'readonly');
    const idx = tx.objectStore(STORES.assets).index('byVaultId');
    return (await reqToPromise(idx.getAll(vaultId))) as AssetRecord[];
  }

  async cloneVaultDeep(vaultId: string, options?: { name?: string; mode?: 'deep' | 'cow' }) {
    const sourceVault = await this.getVault(vaultId);
    if (!sourceVault) throw new Error('Vault not found');
    const [nodes, markdownFiles, assets, links] = await Promise.all([
      this.listNodes(vaultId),
      this.listMarkdownFiles(vaultId),
      this.listAssets(vaultId),
      this.listLinks(vaultId),
    ]);

    const clonedVault = await this.createVault(options?.name ?? `${sourceVault.name} copy`, {
      ...sourceVault.source,
      originalName: sourceVault.source.originalName ?? sourceVault.name,
    });
    clonedVault.cloneOfVaultId = sourceVault.id;
    clonedVault.cloudBeta = sourceVault.cloudBeta?.enabled
      ? {
          enabled: true,
          lastSyncedAt: null,
          lastSyncError: null,
          syncedMarkdownOnly: true,
          attachmentsCloudRequested: sourceVault.cloudBeta?.attachmentsCloudRequested ?? false,
          attachmentsCloudSupported: false,
        }
      : null;
    const db = await this.openDb();
    const tx = db.transaction([STORES.vaults], 'readwrite');
    tx.objectStore(STORES.vaults).put(clonedVault);
    await txDone(tx);

    const nodeIdMap = new Map<string, string>();
    const cloneNodeId = (oldId: string) => {
      const existing = nodeIdMap.get(oldId);
      if (existing) return existing;
      const next = uid('vnode');
      nodeIdMap.set(oldId, next);
      return next;
    };

    const nextNodes: VaultNodeRecord[] = nodes.map((node: VaultNodeRecord) => ({
      ...node,
      id: cloneNodeId(node.id),
      vaultId: clonedVault.id,
      parentId: node.parentId ? cloneNodeId(node.parentId) : undefined,
    }));
    const now = Date.now();
    const nextMarkdown: StoredMarkdownFileRecord[] = [];
    for (const file of markdownFiles) {
      const sharedContentRefId =
        options?.mode === 'cow'
          ? await this.ensureMarkdownContentRefForRecord(file as StoredMarkdownFileRecord)
          : null;
      nextMarkdown.push({
        ...file,
        nodeId: cloneNodeId(file.nodeId),
        vaultId: clonedVault.id,
        updatedAt: now,
        contentRefId: sharedContentRefId,
        ...(options?.mode === 'cow' ? { content: undefined } : {}),
      });
    }
    const nextAssets: { asset: AssetRecord; blob: Blob }[] = [];
    for (const asset of assets) {
      nextAssets.push({
        asset: {
          ...asset,
          id: uid('vasset'),
          vaultId: clonedVault.id,
          blobId: asset.blobId,
        },
        blob: new Blob(),
      });
    }
    const nextLinks: LinkIndexRecord[] = links.map((link: LinkIndexRecord) => ({
      ...link,
      id: uid('vlink'),
      vaultId: clonedVault.id,
      fromNodeId: cloneNodeId(link.fromNodeId),
    }));

    for (let i = 0; i < nextNodes.length; i += 200)
      await this.putNodes(nextNodes.slice(i, i + 200));
    for (let i = 0; i < nextMarkdown.length; i += 100) {
      await this.putMarkdownFiles(nextMarkdown.slice(i, i + 100) as MarkdownFileRecord[]);
    }
    if (nextAssets.length) {
      const txAssets = db.transaction([STORES.assets], 'readwrite');
      const assetStore = txAssets.objectStore(STORES.assets);
      for (const row of nextAssets) assetStore.put(row.asset);
      await txDone(txAssets);
    }
    for (let i = 0; i < nextLinks.length; i += 200)
      await this.putLinkIndex(nextLinks.slice(i, i + 200));

    if (clonedVault.cloudBeta?.enabled && this.canUseCloudVaultSyncBeta()) {
      void this.syncVaultToCloud(clonedVault.id);
    }
    return clonedVault;
  }

  async cloneVault(vaultId: string, options?: { name?: string; mode?: 'deep' | 'cow' }) {
    // Assets remain shared (immutable). Markdown can now share content refs in COW mode.
    return this.cloneVaultDeep(vaultId, { name: options?.name, mode: options?.mode ?? 'cow' });
  }

  async putNodes(nodes: VaultNodeRecord[]) {
    if (!nodes.length) return;
    const db = await this.openDb();
    const tx = db.transaction([STORES.nodes], 'readwrite');
    const store = tx.objectStore(STORES.nodes);
    for (const node of nodes) store.put(node);
    await txDone(tx);
  }

  async putMarkdownFiles(files: MarkdownFileRecord[]) {
    if (!files.length) return;
    const db = await this.openDb();
    const tx = db.transaction([STORES.markdown, STORES.markdownContent], 'readwrite');
    const store = tx.objectStore(STORES.markdown);
    const contentStore = tx.objectStore(STORES.markdownContent);
    for (const file of files as StoredMarkdownFileRecord[]) {
      if (typeof file.content === 'string' && file.content.length > 0) {
        const contentRefId = file.contentRefId ?? this.markdownContentRefId(file.hash);
        contentStore.put({ id: contentRefId, content: file.content, hash: file.hash });
        store.put({ ...file, contentRefId, content: undefined });
      } else {
        store.put(file);
      }
    }
    await txDone(tx);
  }

  async putLinkIndex(links: LinkIndexRecord[]) {
    if (!links.length) return;
    const db = await this.openDb();
    const tx = db.transaction([STORES.links], 'readwrite');
    const store = tx.objectStore(STORES.links);
    for (const link of links) store.put(link);
    await txDone(tx);
  }

  async saveMarkdownFile(nodeId: string, content: string) {
    const [node, current] = await Promise.all([this.getNode(nodeId), this.getMarkdownFile(nodeId)]);
    if (!node || node.type !== 'file') throw new Error('Vault file not found');
    const vaultId = node.vaultId;
    const parsed = parseObsidianMarkdown(content);
    const nextRecord: MarkdownFileRecord = {
      nodeId,
      vaultId,
      content,
      contentRefId: this.markdownContentRefId(parsed.hash),
      frontmatterRaw: parsed.frontmatterRaw,
      frontmatter: parsed.frontmatter,
      headingsIndex: parsed.headingsIndex,
      updatedAt: Date.now(),
      hash: parsed.hash,
    };

    const [allMarkdownFiles, allNodes] = await Promise.all([
      this.listMarkdownFiles(vaultId),
      this.listNodes(vaultId),
    ]);
    const pathLookup = new Map<string, string>();
    const basenameLookup = new Map<string, string[]>();
    const nodeById = new Map(allNodes.map((n) => [n.id, n] as const));
    for (const file of allMarkdownFiles) {
      const fileNode = nodeById.get(file.nodeId);
      if (!fileNode) continue;
      const lowerPath = fileNode.path.toLowerCase();
      const lowerNoExt = lowerPath.replace(/\.md$/i, '');
      pathLookup.set(lowerPath, file.nodeId);
      pathLookup.set(lowerNoExt, file.nodeId);
      const canonicalPath = fileNode.path;
      const basename = lowerNoExt.split('/').pop() ?? lowerNoExt;
      basenameLookup.set(basename, [...(basenameLookup.get(basename) ?? []), canonicalPath]);
      basenameLookup.set(`${basename}.md`, [
        ...(basenameLookup.get(`${basename}.md`) ?? []),
        canonicalPath,
      ]);
    }
    const currentPathLower = node.path.toLowerCase();
    pathLookup.set(currentPathLower, nodeId);
    pathLookup.set(currentPathLower.replace(/\.md$/i, ''), nodeId);

    const nextLinks: LinkIndexRecord[] = parsed.links.map((link) => {
      const resolved = resolveObsidianLinkTarget(
        link.targetPathRaw,
        node.path,
        pathLookup,
        basenameLookup,
      );
      return {
        id: uid('vlink'),
        vaultId,
        fromNodeId: nodeId,
        rawTarget: link.rawTarget,
        targetPath: resolved.targetPath,
        targetHeading: link.targetHeading,
        alias: link.alias,
        type: link.type,
        ambiguous: resolved.ambiguous,
      };
    });

    const db = await this.openDb();
    const tx = db.transaction([STORES.markdown, STORES.markdownContent, STORES.links], 'readwrite');
    tx.objectStore(STORES.markdownContent).put({
      id: nextRecord.contentRefId,
      content: nextRecord.content,
      hash: nextRecord.hash,
    });
    tx.objectStore(STORES.markdown).put({ ...nextRecord, content: undefined });
    const linkStore = tx.objectStore(STORES.links);
    const byFromNode = linkStore.index('byFromNodeId');
    const existingLinkKeys = (await reqToPromise(byFromNode.getAllKeys(nodeId))) as IDBValidKey[];
    for (const key of existingLinkKeys) {
      linkStore.delete(key);
    }
    for (const link of nextLinks) {
      linkStore.put(link);
    }
    await txDone(tx);
    const result = { record: nextRecord, previous: current };
    void this.garbageCollectMarkdownContentRefs();
    const vault = await this.getVault(vaultId);
    if (vault?.cloudBeta?.enabled && this.canUseCloudVaultSyncBeta()) {
      void this.syncVaultToCloud(vaultId);
    }
    return result;
  }

  async putAssets(items: { asset: AssetRecord; blob: Blob }[]) {
    if (!items.length) return;
    const db = await this.openDb();
    const tx = db.transaction([STORES.assets, STORES.blobs], 'readwrite');
    const assetStore = tx.objectStore(STORES.assets);
    const blobStore = tx.objectStore(STORES.blobs);
    for (const item of items) {
      assetStore.put(item.asset);
      blobStore.put({ id: item.asset.blobId, blob: item.blob });
    }
    await txDone(tx);
  }

  async getTree(vaultId: string): Promise<VaultFileTreeNode[]> {
    const db = await this.openDb();
    const tx = db.transaction([STORES.nodes], 'readonly');
    const index = tx.objectStore(STORES.nodes).index('byVaultId');
    const rows = (await reqToPromise(index.getAll(vaultId))) as VaultNodeRecord[];
    const map = new Map<string, VaultFileTreeNode>();
    for (const row of rows) {
      map.set(row.id, {
        id: row.id,
        path: row.path,
        name: row.path.split('/').pop() || row.path,
        type: row.type,
        parentId: row.parentId,
        children: row.type === 'folder' ? [] : undefined,
      });
    }
    const roots: VaultFileTreeNode[] = [];
    for (const node of map.values()) {
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId)?.children?.push(node);
      } else {
        roots.push(node);
      }
    }
    const sortNodes = (nodes: VaultFileTreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
      for (const node of nodes) {
        if (node.children) sortNodes(node.children);
      }
    };
    sortNodes(roots);
    return roots;
  }

  async getMarkdownFile(nodeId: string) {
    const db = await this.openDb();
    const tx = db.transaction([STORES.markdown], 'readonly');
    const row = (await reqToPromise(tx.objectStore(STORES.markdown).get(nodeId))) as
      | StoredMarkdownFileRecord
      | undefined;
    if (!row) return undefined;
    return this.hydrateMarkdownRecord(row);
  }

  async getNode(nodeId: string) {
    const db = await this.openDb();
    const tx = db.transaction([STORES.nodes], 'readonly');
    return (await reqToPromise(tx.objectStore(STORES.nodes).get(nodeId))) as
      | VaultNodeRecord
      | undefined;
  }

  async getNodeByPath(vaultId: string, path: string) {
    const db = await this.openDb();
    const tx = db.transaction([STORES.nodes], 'readonly');
    const idx = tx.objectStore(STORES.nodes).index('byVaultPath');
    return (await reqToPromise(idx.get([vaultId, path]))) as VaultNodeRecord | undefined;
  }

  async getAsset(vaultId: string, path: string) {
    const db = await this.openDb();
    const tx = db.transaction([STORES.assets], 'readonly');
    const idx = tx.objectStore(STORES.assets).index('byVaultPath');
    return (await reqToPromise(idx.get([vaultId, path]))) as AssetRecord | undefined;
  }

  async getAssetUrl(vaultId: string, path: string) {
    const cacheKey = `${vaultId}:${path}`;
    const cached = this.assetUrlCache.get(cacheKey);
    if (cached) return cached;
    const asset = await this.getAsset(vaultId, path);
    if (!asset) return null;
    const db = await this.openDb();
    const tx = db.transaction([STORES.blobs], 'readonly');
    const blobRow = (await reqToPromise(tx.objectStore(STORES.blobs).get(asset.blobId))) as
      | { id: string; blob: Blob }
      | undefined;
    if (!blobRow?.blob) return null;
    const url = URL.createObjectURL(blobRow.blob);
    this.assetUrlCache.set(cacheKey, url);
    return url;
  }

  revokeAssetUrlsForVault(vaultId: string) {
    for (const [key, url] of this.assetUrlCache.entries()) {
      if (!key.startsWith(`${vaultId}:`)) continue;
      URL.revokeObjectURL(url);
      this.assetUrlCache.delete(key);
    }
  }

  async listUnresolvedLinks(vaultId: string) {
    const links = await this.listLinks(vaultId);
    return links.filter((link) => !link.targetPath);
  }

  async getVaultCloudBetaSummary(vaultId: string) {
    const [vault, nodes, markdown, links, assets] = await Promise.all([
      this.getVault(vaultId),
      this.listNodes(vaultId),
      this.listMarkdownFiles(vaultId),
      this.listLinks(vaultId),
      this.listAssets(vaultId),
    ]);
    return {
      cloudEnabled: Boolean(vault?.cloudBeta?.enabled),
      syncedMarkdownOnly: true,
      attachmentsCloudRequested: Boolean(vault?.cloudBeta?.attachmentsCloudRequested),
      attachmentsCloudSupported: Boolean(vault?.cloudBeta?.attachmentsCloudSupported),
      counts: {
        nodes: nodes.length,
        markdown: markdown.length,
        links: links.length,
        assets: assets.length,
      },
      assetBytes: assets.reduce((sum, asset) => sum + (asset.size || 0), 0),
    };
  }

  async createMarkdownNoteByPath(vaultId: string, pathInput: string, content = '') {
    const path = this.normalizeVaultMarkdownPath(pathInput);
    const existing = await this.getNodeByPath(vaultId, path);
    if (existing?.type === 'file') return existing;
    const nodes = await this.listNodes(vaultId);
    const existingByPath = new Map(nodes.map((n) => [n.path, n] as const));
    const parts = path.split('/').filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) throw new Error('Invalid path');
    let parentId: string | undefined;
    let parentPath = '';
    const newNodes: VaultNodeRecord[] = [];
    for (const part of parts) {
      const nextPath = parentPath ? `${parentPath}/${part}` : part;
      const existingFolder = existingByPath.get(nextPath);
      if (existingFolder?.type === 'folder') {
        parentId = existingFolder.id;
        parentPath = nextPath;
        continue;
      }
      const folder: VaultNodeRecord = {
        id: uid('vnode'),
        vaultId,
        path: nextPath,
        type: 'folder',
        ...(parentId ? { parentId } : {}),
      };
      newNodes.push(folder);
      existingByPath.set(nextPath, folder);
      parentId = folder.id;
      parentPath = nextPath;
    }
    if (newNodes.length) await this.putNodes(newNodes);
    const filePath = parentPath ? `${parentPath}/${fileName}` : fileName;
    const node: VaultNodeRecord = {
      id: uid('vnode'),
      vaultId,
      path: filePath,
      type: 'file',
      ...(parentId ? { parentId } : {}),
    };
    await this.putNodes([node]);
    await this.saveMarkdownFile(node.id, content);
    return node;
  }

  async syncVaultToCloud(vaultId: string) {
    if (!this.canUseCloudVaultSyncBeta()) return;
    const existing = this.cloudSyncInflight.get(vaultId);
    if (existing) return existing;
    const run = this.syncVaultToCloudInternal(vaultId)
      .catch(async (error) => {
        const vault = await this.getVault(vaultId);
        if (vault?.cloudBeta?.enabled) {
          vault.cloudBeta = {
            ...vault.cloudBeta,
            lastSyncError: error instanceof Error ? error.message : 'sync_failed',
            syncedMarkdownOnly: true,
            attachmentsCloudSupported: false,
          };
          await this.putVault(vault);
        }
      })
      .finally(() => {
        this.cloudSyncInflight.delete(vaultId);
      });
    this.cloudSyncInflight.set(vaultId, run);
    return run;
  }

  private async syncVaultToCloudInternal(vaultId: string) {
    const vault = await this.getVault(vaultId);
    if (!vault || !vault.cloudBeta?.enabled) return;
    const [nodes, markdownFiles, links, assets] = await Promise.all([
      this.listNodes(vaultId),
      this.listMarkdownFiles(vaultId),
      this.listLinks(vaultId),
      this.listAssets(vaultId),
    ]);
    const updatedAt = Date.now();
    const chunks = {
      nodes: this.chunkJsonArray(nodes),
      markdown: this.chunkJsonArray(markdownFiles),
      links: this.chunkJsonArray(links),
    };
    const manifest = {
      version: 1,
      vaultId,
      updatedAt,
      vault: {
        id: vault.id,
        name: vault.name,
        createdAt: vault.createdAt,
        source: vault.source,
        cloneOfVaultId: vault.cloneOfVaultId ?? null,
      },
      counts: {
        nodes: nodes.length,
        markdown: markdownFiles.length,
        links: links.length,
        assets: assets.length,
      },
      chunks: {
        nodes: chunks.nodes.length,
        markdown: chunks.markdown.length,
        links: chunks.links.length,
      },
      assetsStoredInCloud: false,
      assetsMetadataOnly: true,
      attachmentsCloudRequested: Boolean(vault.cloudBeta?.attachmentsCloudRequested),
      attachmentsCloudSupported: false,
    };
    const keysToKeep = new Set<string>([
      this.cloudIndexKey(vaultId),
      this.cloudManifestKey(vaultId),
    ]);
    for (let i = 0; i < chunks.nodes.length; i += 1)
      keysToKeep.add(this.cloudChunkKey(vaultId, 'nodes', i));
    for (let i = 0; i < chunks.markdown.length; i += 1)
      keysToKeep.add(this.cloudChunkKey(vaultId, 'markdown', i));
    for (let i = 0; i < chunks.links.length; i += 1)
      keysToKeep.add(this.cloudChunkKey(vaultId, 'links', i));

    const previousIndex = await this.storage.getJson<{ keys?: string[] } | null>(
      this.cloudIndexKey(vaultId),
      null,
    );
    await this.storage.setJson(this.cloudManifestKey(vaultId), manifest);
    for (let i = 0; i < chunks.nodes.length; i += 1) {
      await this.storage.setJson(this.cloudChunkKey(vaultId, 'nodes', i), chunks.nodes[i]);
    }
    for (let i = 0; i < chunks.markdown.length; i += 1) {
      await this.storage.setJson(this.cloudChunkKey(vaultId, 'markdown', i), chunks.markdown[i]);
    }
    for (let i = 0; i < chunks.links.length; i += 1) {
      await this.storage.setJson(this.cloudChunkKey(vaultId, 'links', i), chunks.links[i]);
    }
    await this.cleanupCloudVaultExtraKeys(previousIndex, keysToKeep);
    await this.storage.setJson(this.cloudIndexKey(vaultId), {
      vaultId,
      updatedAt,
      keys: Array.from(keysToKeep),
    });

    vault.cloudBeta = {
      enabled: true,
      lastSyncedAt: updatedAt,
      lastSyncError: null,
      syncedMarkdownOnly: true,
      attachmentsCloudRequested: Boolean(vault.cloudBeta?.attachmentsCloudRequested),
      attachmentsCloudSupported: false,
    };
    await this.putVault(vault);
  }

  private async restoreVaultFromCloud(vaultId: string) {
    const manifest = await this.storage.getJson<{
      version: number;
      vaultId: string;
      vault: Omit<VaultRecord, 'cloudBeta'>;
      chunks: { nodes: number; markdown: number; links: number };
      assetsStoredInCloud?: boolean;
      assetsMetadataOnly?: boolean;
      attachmentsCloudRequested?: boolean;
      attachmentsCloudSupported?: boolean;
    } | null>(this.cloudManifestKey(vaultId), null);
    if (!manifest || manifest.vaultId !== vaultId) return false;

    const [nodes, markdown, links] = await Promise.all([
      this.loadCloudChunks<VaultNodeRecord>(vaultId, 'nodes', manifest.chunks.nodes),
      this.loadCloudChunks<MarkdownFileRecord>(vaultId, 'markdown', manifest.chunks.markdown),
      this.loadCloudChunks<LinkIndexRecord>(vaultId, 'links', manifest.chunks.links),
    ]);
    const restoredVault: VaultRecord = {
      ...manifest.vault,
      cloudBeta: {
        enabled: true,
        lastSyncedAt: Date.now(),
        lastSyncError: null,
        syncedMarkdownOnly: true,
        attachmentsCloudRequested: Boolean(manifest.attachmentsCloudRequested),
        attachmentsCloudSupported: Boolean(manifest.attachmentsCloudSupported),
      },
    };

    const db = await this.openDb();
    const tx = db.transaction(
      [STORES.vaults, STORES.nodes, STORES.markdown, STORES.links],
      'readwrite',
    );
    tx.objectStore(STORES.vaults).put(restoredVault);
    const nodeStore = tx.objectStore(STORES.nodes);
    for (const row of nodes) nodeStore.put(row);
    const mdStore = tx.objectStore(STORES.markdown);
    for (const row of markdown) mdStore.put(row);
    const linkStore = tx.objectStore(STORES.links);
    for (const row of links) linkStore.put(row);
    await txDone(tx);
    return true;
  }

  private async cleanupCloudVaultExtraKeys(
    previousIndex: { keys?: string[] } | null,
    keysToKeep: Set<string>,
  ) {
    const previousKeys = Array.isArray(previousIndex?.keys) ? previousIndex.keys : [];
    for (const key of previousKeys) {
      if (!keysToKeep.has(key)) {
        await this.storage.removeItem(key);
      }
    }
  }

  private chunkJsonArray<T>(items: T[]) {
    const chunks: T[][] = [];
    let current: T[] = [];
    let currentBytes = 2; // []
    for (const item of items) {
      const json = JSON.stringify(item);
      const bytes = this.byteLength(json) + (current.length ? 1 : 0);
      if (current.length && currentBytes + bytes > CLOUD_CHUNK_TARGET_BYTES) {
        chunks.push(current);
        current = [];
        currentBytes = 2;
      }
      current.push(item);
      currentBytes += bytes;
    }
    if (current.length) chunks.push(current);
    return chunks;
  }

  private async loadCloudChunks<T>(
    vaultId: string,
    section: 'nodes' | 'markdown' | 'links',
    count: number,
  ) {
    const out: T[] = [];
    for (let i = 0; i < count; i += 1) {
      const rows = await this.storage.getJson<T[]>(this.cloudChunkKey(vaultId, section, i), []);
      out.push(...rows);
    }
    return out;
  }

  private cloudManifestKey(vaultId: string) {
    return `${CLOUD_VAULT_PREFIX}:${vaultId}:manifest`;
  }

  private cloudIndexKey(vaultId: string) {
    return `${CLOUD_VAULT_PREFIX}:${vaultId}:index`;
  }

  private cloudChunkKey(vaultId: string, section: 'nodes' | 'markdown' | 'links', index: number) {
    return `${CLOUD_VAULT_PREFIX}:${vaultId}:${section}:${index}`;
  }

  private byteLength(value: string) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
    return value.length * 2;
  }

  private markdownContentRefId(hash: string) {
    return `mdc_${hash}`;
  }

  private normalizeVaultMarkdownPath(pathInput: string) {
    let next = pathInput
      .replace(/\\/g, '/')
      .replace(/^\.?\/*/, '')
      .trim();
    if (!next) next = 'New note.md';
    if (!/\.md$/i.test(next)) next = `${next}.md`;
    return next;
  }

  async garbageCollectMarkdownContentRefs() {
    const db = await this.openDb();
    const tx = db.transaction([STORES.markdown, STORES.markdownContent], 'readwrite');
    const mdStore = tx.objectStore(STORES.markdown);
    const contentStore = tx.objectStore(STORES.markdownContent);
    const markdownRows = (await reqToPromise(mdStore.getAll())) as StoredMarkdownFileRecord[];
    const referenced = new Set(
      markdownRows.map((row) => row.contentRefId).filter(Boolean) as string[],
    );
    const keys = (await reqToPromise(contentStore.getAllKeys())) as string[];
    for (const key of keys) {
      if (!referenced.has(key)) contentStore.delete(key);
    }
    await txDone(tx);
  }

  private async ensureMarkdownContentRefForRecord(record: StoredMarkdownFileRecord) {
    if (record.contentRefId) return record.contentRefId;
    if (typeof record.content !== 'string') return null;
    const contentRefId = this.markdownContentRefId(record.hash);
    const db = await this.openDb();
    const tx = db.transaction([STORES.markdown, STORES.markdownContent], 'readwrite');
    tx.objectStore(STORES.markdownContent).put({
      id: contentRefId,
      content: record.content,
      hash: record.hash,
    });
    tx.objectStore(STORES.markdown).put({ ...record, contentRefId, content: undefined });
    await txDone(tx);
    return contentRefId;
  }

  private async hydrateMarkdownRecord(row: StoredMarkdownFileRecord): Promise<MarkdownFileRecord> {
    if (typeof row.content === 'string') {
      return row as MarkdownFileRecord;
    }
    if (!row.contentRefId) {
      return { ...(row as MarkdownFileRecord), content: '' };
    }
    const db = await this.openDb();
    const tx = db.transaction([STORES.markdownContent], 'readonly');
    const contentRow = (await reqToPromise(
      tx.objectStore(STORES.markdownContent).get(row.contentRefId),
    )) as { id: string; content: string; hash?: string } | undefined;
    return { ...(row as MarkdownFileRecord), content: contentRow?.content ?? '' };
  }
}
