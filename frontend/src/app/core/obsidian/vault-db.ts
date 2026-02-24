import { Injectable } from '@angular/core';
import {
  AssetRecord,
  LinkIndexRecord,
  MarkdownFileRecord,
  ObsidianImportSourceType,
  VaultFileTreeNode,
  VaultNodeRecord,
  VaultRecord,
} from './vault-types';

const DB_NAME = 'operator-obsidian-vaults';
const DB_VERSION = 1;

const STORES = {
  vaults: 'vaults',
  nodes: 'vault_nodes',
  markdown: 'vault_markdown',
  assets: 'vault_assets',
  blobs: 'vault_asset_blobs',
  links: 'vault_links',
} as const;

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

  private openDb() {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORES.vaults)) {
          db.createObjectStore(STORES.vaults, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.nodes)) {
          const store = db.createObjectStore(STORES.nodes, { keyPath: 'id' });
          store.createIndex('byVaultId', 'vaultId', { unique: false });
          store.createIndex('byVaultPath', ['vaultId', 'path'], { unique: true });
        }
        if (!db.objectStoreNames.contains(STORES.markdown)) {
          const store = db.createObjectStore(STORES.markdown, { keyPath: 'nodeId' });
          store.createIndex('byVaultId', 'vaultId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORES.assets)) {
          const store = db.createObjectStore(STORES.assets, { keyPath: 'id' });
          store.createIndex('byVaultId', 'vaultId', { unique: false });
          store.createIndex('byVaultPath', ['vaultId', 'path'], { unique: true });
        }
        if (!db.objectStoreNames.contains(STORES.blobs)) {
          db.createObjectStore(STORES.blobs, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.links)) {
          const store = db.createObjectStore(STORES.links, { keyPath: 'id' });
          store.createIndex('byVaultId', 'vaultId', { unique: false });
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
    return (await reqToPromise(index.getAll(vaultId))) as MarkdownFileRecord[];
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

  async cloneVaultDeep(vaultId: string, options?: { name?: string }) {
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
    const nextMarkdown: MarkdownFileRecord[] = markdownFiles.map((file: MarkdownFileRecord) => ({
      ...file,
      nodeId: cloneNodeId(file.nodeId),
      vaultId: clonedVault.id,
      updatedAt: now,
    }));
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
      await this.putMarkdownFiles(nextMarkdown.slice(i, i + 100));
    }
    if (nextAssets.length) {
      const txAssets = db.transaction([STORES.assets], 'readwrite');
      const assetStore = txAssets.objectStore(STORES.assets);
      for (const row of nextAssets) assetStore.put(row.asset);
      await txDone(txAssets);
    }
    for (let i = 0; i < nextLinks.length; i += 200)
      await this.putLinkIndex(nextLinks.slice(i, i + 200));

    return clonedVault;
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
    const tx = db.transaction([STORES.markdown], 'readwrite');
    const store = tx.objectStore(STORES.markdown);
    for (const file of files) store.put(file);
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
    return (await reqToPromise(tx.objectStore(STORES.markdown).get(nodeId))) as
      | MarkdownFileRecord
      | undefined;
  }

  async getNode(nodeId: string) {
    const db = await this.openDb();
    const tx = db.transaction([STORES.nodes], 'readonly');
    return (await reqToPromise(tx.objectStore(STORES.nodes).get(nodeId))) as
      | VaultNodeRecord
      | undefined;
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
}
