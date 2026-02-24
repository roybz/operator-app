import { Injectable, inject } from '@angular/core';
import { VaultDbService } from './vault-db';
import {
  inferMimeType,
  isIgnoredVaultPath,
  isMarkdownPath,
  normalizeVaultPath,
  parseObsidianMarkdown,
  resolveObsidianLinkTarget,
} from './obsidian-parse';
import {
  AssetRecord,
  ImportObsidianInput,
  LinkIndexRecord,
  MarkdownFileRecord,
  ObsidianImportProgress,
  ObsidianImportResult,
  ObsidianImportStats,
  VaultNodeRecord,
} from './vault-types';

function uid(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

@Injectable({ providedIn: 'root' })
export class ObsidianImportService {
  private readonly db = inject(VaultDbService);

  async importObsidianVault(
    input: ImportObsidianInput,
    options?: { onProgress?: (progress: ObsidianImportProgress) => void },
  ): Promise<ObsidianImportResult> {
    if (input.type === 'folder') {
      return this.importObsidianFolder(input.handle, options);
    }
    const onProgress = options?.onProgress;
    const buffer = await input.file.arrayBuffer();
    const worker = new Worker(new URL('./obsidian-import.worker.ts', import.meta.url), {
      type: 'module',
    });

    interface ParsedNode {
      id: string;
      path: string;
      type: 'folder' | 'file';
      parentId?: string;
    }
    interface ParsedMarkdownFile {
      nodeId: string;
      path: string;
      content: string;
      frontmatterRaw?: string;
      frontmatter?: Record<string, unknown> | null;
      headingsIndex: { depth: number; text: string; slug: string; line: number }[];
      hash: string;
    }
    interface ParsedLink {
      fromNodeId: string;
      rawTarget: string;
      targetHeading?: string;
      alias?: string;
      type: 'wikilink' | 'embed';
      targetPath?: string;
      ambiguous?: boolean;
    }
    interface ParsedAsset {
      path: string;
      mime: string;
      size: number;
      bytes: Uint8Array;
    }
    interface WorkerParsedResult {
      vaultName: string;
      nodes: ParsedNode[];
      markdownFiles: ParsedMarkdownFile[];
      assets: ParsedAsset[];
      links: ParsedLink[];
      unresolvedLinks: number;
    }

    const parsed = await new Promise<WorkerParsedResult>((resolve, reject) => {
      worker.onmessage = (event) => {
        const msg = event.data;
        switch (msg?.type) {
          case 'SCAN_PROGRESS':
            onProgress?.({ phase: 'scan', scanned: msg.scanned, total: msg.total });
            break;
          case 'PARSE_PROGRESS':
            onProgress?.({ phase: 'parse', parsed: msg.parsed, total: msg.total });
            break;
          case 'ASSET_PROGRESS':
            onProgress?.({
              phase: 'assets',
              storedBytes: msg.storedBytes,
              totalBytes: msg.totalBytes,
            });
            break;
          case 'LINK_PROGRESS':
            onProgress?.({ phase: 'links', resolved: msg.resolved, totalLinks: msg.totalLinks });
            break;
          case 'DONE':
            resolve(msg.payload);
            break;
          case 'ERROR':
            reject(new Error(String(msg.message || 'Obsidian import failed')));
            break;
          default:
            break;
        }
      };
      worker.onerror = (event) => reject(event.error ?? new Error('Import worker crashed'));
      worker.postMessage({ type: 'IMPORT_ZIP', payload: { buffer, fileName: input.file.name } }, [
        buffer,
      ]);
    }).finally(() => worker.terminate());

    return this.storeParsedVaultPayload(
      {
        vaultName: parsed.vaultName,
        sourceType: 'zip',
        sourceOriginalName: input.file.name,
        nodes: parsed.nodes,
        markdownFiles: parsed.markdownFiles,
        assets: parsed.assets,
        links: parsed.links,
        unresolvedLinks: parsed.unresolvedLinks,
      },
      onProgress,
    );
  }

  private async importObsidianFolder(
    rootHandle: FileSystemDirectoryHandle,
    options?: { onProgress?: (progress: ObsidianImportProgress) => void },
  ): Promise<ObsidianImportResult> {
    const onProgress = options?.onProgress;
    const files: { path: string; file: File }[] = [];
    const walk = async (dir: FileSystemDirectoryHandle, prefix = ''): Promise<void> => {
      for await (const [name, handle] of dir.entries()) {
        const path = normalizeVaultPath(prefix ? `${prefix}/${name}` : name);
        if (isIgnoredVaultPath(path)) continue;
        if (handle.kind === 'directory') {
          await walk(handle as FileSystemDirectoryHandle, path);
        } else {
          files.push({ path, file: await (handle as FileSystemFileHandle).getFile() });
        }
      }
    };
    await walk(rootHandle);
    onProgress?.({ phase: 'scan', scanned: files.length, total: files.length });

    const nodes: { id: string; path: string; type: 'folder' | 'file'; parentId?: string }[] = [];
    const nodeByPath = new Map<
      string,
      { id: string; path: string; type: 'folder' | 'file'; parentId?: string }
    >();
    const ensureFolderChain = (path: string) => {
      const parts = path.split('/').filter(Boolean);
      let current = '';
      let parentId: string | undefined;
      for (const part of parts.slice(0, -1)) {
        current = current ? `${current}/${part}` : part;
        if (nodeByPath.has(current)) {
          parentId = nodeByPath.get(current)?.id;
          continue;
        }
        const node = { id: uid('vnode'), path: current, type: 'folder' as const, parentId };
        nodeByPath.set(current, node);
        nodes.push(node);
        parentId = node.id;
      }
    };

    const markdownFiles: {
      nodeId: string;
      path: string;
      content: string;
      frontmatterRaw?: string;
      frontmatter?: Record<string, unknown> | null;
      headingsIndex: { depth: number; text: string; slug: string; line: number }[];
      hash: string;
    }[] = [];
    const assets: { path: string; mime: string; size: number; bytes: Uint8Array }[] = [];
    const rawLinks: {
      fromNodeId: string;
      sourcePath: string;
      rawTarget: string;
      targetPathRaw: string;
      targetHeading?: string;
      alias?: string;
      type: 'wikilink' | 'embed';
    }[] = [];
    let parsedCount = 0;
    let assetBytes = 0;
    const totalAssetBytes = files
      .filter((entry) => !isMarkdownPath(entry.path))
      .reduce((sum, entry) => sum + entry.file.size, 0);

    for (const entry of files) {
      ensureFolderChain(entry.path);
      const parentPath = entry.path.includes('/')
        ? entry.path.slice(0, entry.path.lastIndexOf('/'))
        : '';
      const parentId = parentPath ? nodeByPath.get(parentPath)?.id : undefined;
      const fileNode = { id: uid('vnode'), path: entry.path, type: 'file' as const, parentId };
      nodeByPath.set(entry.path, fileNode);
      nodes.push(fileNode);

      if (isMarkdownPath(entry.path)) {
        const content = await entry.file.text();
        const parsed = parseObsidianMarkdown(content);
        markdownFiles.push({
          nodeId: fileNode.id,
          path: entry.path,
          content,
          frontmatterRaw: parsed.frontmatterRaw,
          frontmatter: parsed.frontmatter,
          headingsIndex: parsed.headingsIndex,
          hash: parsed.hash,
        });
        parsed.links.forEach((link) =>
          rawLinks.push({ fromNodeId: fileNode.id, sourcePath: entry.path, ...link }),
        );
        parsedCount += 1;
        onProgress?.({ phase: 'parse', parsed: parsedCount, total: files.length });
      } else {
        const bytes = new Uint8Array(await entry.file.arrayBuffer());
        assets.push({
          path: entry.path,
          mime: entry.file.type || inferMimeType(entry.path),
          size: entry.file.size,
          bytes,
        });
        assetBytes += entry.file.size;
        onProgress?.({ phase: 'assets', storedBytes: assetBytes, totalBytes: totalAssetBytes });
      }
    }

    const pathLookup = new Map<string, string>();
    const basenameLookup = new Map<string, string[]>();
    for (const file of markdownFiles) {
      const lowerPath = file.path.toLowerCase();
      const lowerNoExt = lowerPath.replace(/\.md$/i, '');
      pathLookup.set(lowerPath, file.nodeId);
      pathLookup.set(lowerNoExt, file.nodeId);
      const basename = lowerNoExt.split('/').pop() ?? lowerNoExt;
      basenameLookup.set(basename, [...(basenameLookup.get(basename) ?? []), file.path]);
      basenameLookup.set(`${basename}.md`, [
        ...(basenameLookup.get(`${basename}.md`) ?? []),
        file.path,
      ]);
    }
    let resolvedCount = 0;
    let unresolvedCount = 0;
    const links = rawLinks.map((link) => {
      const resolved = resolveObsidianLinkTarget(
        link.targetPathRaw,
        link.sourcePath,
        pathLookup,
        basenameLookup,
      );
      if (resolved.targetPath) resolvedCount += 1;
      else unresolvedCount += 1;
      return { ...link, targetPath: resolved.targetPath, ambiguous: resolved.ambiguous };
    });
    onProgress?.({ phase: 'links', resolved: resolvedCount, totalLinks: links.length });

    return this.storeParsedVaultPayload(
      {
        vaultName: rootHandle.name || 'Imported Vault',
        sourceType: 'folder',
        sourceOriginalName: rootHandle.name,
        nodes,
        markdownFiles,
        assets,
        links,
        unresolvedLinks: unresolvedCount,
      },
      onProgress,
    );
  }

  private async storeParsedVaultPayload(
    parsed: {
      vaultName: string;
      sourceType: 'zip' | 'folder';
      sourceOriginalName?: string;
      nodes: { id: string; path: string; type: 'folder' | 'file'; parentId?: string }[];
      markdownFiles: {
        nodeId: string;
        path: string;
        content: string;
        frontmatterRaw?: string;
        frontmatter?: Record<string, unknown> | null;
        headingsIndex: { depth: number; text: string; slug: string; line: number }[];
        hash: string;
      }[];
      assets: { path: string; mime: string; size: number; bytes: Uint8Array }[];
      links: {
        fromNodeId: string;
        rawTarget: string;
        targetHeading?: string;
        alias?: string;
        type: 'wikilink' | 'embed';
        targetPath?: string;
        ambiguous?: boolean;
      }[];
      unresolvedLinks: number;
    },
    onProgress?: (progress: ObsidianImportProgress) => void,
  ): Promise<ObsidianImportResult> {
    const vault = await this.db.createVault(parsed.vaultName, {
      type: parsed.sourceType,
      originalName: parsed.sourceOriginalName,
    });

    const now = Date.now();
    const nodes: VaultNodeRecord[] = parsed.nodes.map((node) => ({
      ...node,
      vaultId: vault.id,
    }));
    const markdownFiles: MarkdownFileRecord[] = parsed.markdownFiles.map((file) => ({
      nodeId: file.nodeId,
      vaultId: vault.id,
      content: file.content,
      frontmatterRaw: file.frontmatterRaw,
      frontmatter: file.frontmatter,
      headingsIndex: file.headingsIndex,
      updatedAt: now,
      hash: file.hash,
    }));
    const links: LinkIndexRecord[] = parsed.links.map((link) => ({
      id: uid('vlink'),
      vaultId: vault.id,
      fromNodeId: link.fromNodeId,
      rawTarget: link.rawTarget,
      targetPath: link.targetPath,
      targetHeading: link.targetHeading,
      alias: link.alias,
      type: link.type,
      ambiguous: link.ambiguous,
    }));
    const assetRows = parsed.assets.map((asset) => {
      const blobId = uid('vblob');
      const assetRecord: AssetRecord = {
        id: uid('vasset'),
        vaultId: vault.id,
        path: asset.path,
        mime: asset.mime,
        size: asset.size,
        blobId,
      };
      const blobBytes = new Uint8Array(asset.bytes.byteLength);
      blobBytes.set(asset.bytes);
      return {
        asset: assetRecord,
        blob: new Blob([blobBytes], { type: asset.mime }),
      };
    });

    for (let i = 0; i < nodes.length; i += 200) await this.db.putNodes(nodes.slice(i, i + 200));
    for (let i = 0; i < markdownFiles.length; i += 100) {
      await this.db.putMarkdownFiles(markdownFiles.slice(i, i + 100));
    }
    for (let i = 0; i < assetRows.length; i += 50)
      await this.db.putAssets(assetRows.slice(i, i + 50));
    for (let i = 0; i < links.length; i += 200) await this.db.putLinkIndex(links.slice(i, i + 200));

    const stats: ObsidianImportStats = {
      scannedFiles: parsed.nodes.filter((node) => node.type === 'file').length,
      markdownCount: markdownFiles.length,
      assetCount: assetRows.length,
      assetBytes: assetRows.reduce((sum, row) => sum + row.asset.size, 0),
      linksCount: links.length,
      resolvedLinksCount: links.filter((link) => Boolean(link.targetPath)).length,
      unresolvedLinksCount: Number(parsed.unresolvedLinks || 0),
    };
    onProgress?.({ phase: 'done' });
    return { vaultId: vault.id, vaultName: vault.name, stats };
  }
}
