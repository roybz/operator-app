/// <reference lib="webworker" />
import { strFromU8, unzipSync } from 'fflate';
import {
  inferMimeType,
  isIgnoredVaultPath,
  isMarkdownPath,
  normalizeVaultPath,
  parseObsidianMarkdown,
  resolveObsidianLinkTarget,
} from './obsidian-parse';

interface WorkerIn {
  type: 'IMPORT_ZIP';
  payload: { buffer: ArrayBuffer; fileName: string };
}

interface TempNode {
  id: string;
  path: string;
  type: 'folder' | 'file';
  parentId?: string;
}

interface WorkerMarkdownFile {
  nodeId: string;
  path: string;
  content: string;
  frontmatterRaw?: string;
  frontmatter?: Record<string, unknown> | null;
  headingsIndex: { depth: number; text: string; slug: string; line: number }[];
  hash: string;
}

interface WorkerAsset {
  path: string;
  mime: string;
  size: number;
  bytes: Uint8Array;
}

interface WorkerRawLink {
  fromNodeId: string;
  sourcePath: string;
  rawTarget: string;
  targetPathRaw: string;
  targetHeading?: string;
  alias?: string;
  type: 'wikilink' | 'embed';
}

function post(message: unknown) {
  self.postMessage(message);
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function ensureFolderNodes(filePaths: string[], nodesByPath: Map<string, TempNode>) {
  for (const filePath of filePaths) {
    const parts = filePath.split('/').filter(Boolean);
    let current = '';
    let parentId: string | undefined;
    for (const part of parts.slice(0, -1)) {
      current = current ? `${current}/${part}` : part;
      if (nodesByPath.has(current)) {
        parentId = nodesByPath.get(current)?.id;
        continue;
      }
      const node: TempNode = { id: uid('vnode'), path: current, type: 'folder', parentId };
      nodesByPath.set(current, node);
      parentId = node.id;
    }
  }
}

self.onmessage = (event: MessageEvent<WorkerIn>) => {
  void (async () => {
    try {
      if (event.data.type !== 'IMPORT_ZIP') return;
      const zipEntries = unzipSync(new Uint8Array(event.data.payload.buffer));
      const entries = Object.entries(zipEntries)
        .map(([rawPath, bytes]) => ({ path: normalizeVaultPath(rawPath), bytes }))
        .filter(
          (entry) => entry.path && !entry.path.endsWith('/') && !isIgnoredVaultPath(entry.path),
        );

      const nodesByPath = new Map<string, TempNode>();
      ensureFolderNodes(
        entries.map((entry) => entry.path),
        nodesByPath,
      );

      post({ type: 'SCAN_PROGRESS', scanned: 0, total: entries.length });
      const totalAssetBytes = entries
        .filter((entry) => !isMarkdownPath(entry.path))
        .reduce((sum, entry) => sum + entry.bytes.byteLength, 0);

      const markdownFiles: WorkerMarkdownFile[] = [];
      const assets: WorkerAsset[] = [];
      const rawLinks: WorkerRawLink[] = [];
      let parsedMarkdown = 0;
      let scanned = 0;
      let assetBytes = 0;

      for (const entry of entries) {
        scanned += 1;
        post({ type: 'SCAN_PROGRESS', scanned, total: entries.length });
        const parentPath = entry.path.includes('/')
          ? entry.path.slice(0, entry.path.lastIndexOf('/'))
          : '';
        const parentId = parentPath ? nodesByPath.get(parentPath)?.id : undefined;
        const fileNode: TempNode = { id: uid('vnode'), path: entry.path, type: 'file', parentId };
        nodesByPath.set(entry.path, fileNode);

        if (isMarkdownPath(entry.path)) {
          const content = strFromU8(entry.bytes);
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
            rawLinks.push({
              fromNodeId: fileNode.id,
              sourcePath: entry.path,
              ...link,
            }),
          );
          parsedMarkdown += 1;
          post({ type: 'PARSE_PROGRESS', parsed: parsedMarkdown, total: entries.length });
        } else {
          const size = entry.bytes.byteLength;
          assets.push({
            path: entry.path,
            mime: inferMimeType(entry.path),
            size,
            bytes: entry.bytes,
          });
          assetBytes += size;
          post({ type: 'ASSET_PROGRESS', storedBytes: assetBytes, totalBytes: totalAssetBytes });
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
          String(link.targetPathRaw || ''),
          String(link.sourcePath || ''),
          pathLookup,
          basenameLookup,
        );
        if (resolved.targetPath) resolvedCount += 1;
        else unresolvedCount += 1;
        return {
          fromNodeId: link.fromNodeId,
          rawTarget: link.rawTarget,
          targetHeading: link.targetHeading,
          alias: link.alias,
          type: link.type,
          targetPath: resolved.targetPath,
          ambiguous: resolved.ambiguous,
        };
      });
      post({ type: 'LINK_PROGRESS', resolved: resolvedCount, totalLinks: links.length });

      post({
        type: 'DONE',
        payload: {
          vaultName: event.data.payload.fileName.replace(/\.zip$/i, '') || 'Imported Vault',
          nodes: Array.from(nodesByPath.values()),
          markdownFiles,
          assets,
          links,
          unresolvedLinks: unresolvedCount,
        },
      });
    } catch (error) {
      post({
        type: 'ERROR',
        message: error instanceof Error ? error.message : 'Obsidian import failed',
      });
    }
  })();
};
