export type ObsidianImportSourceType = 'folder' | 'zip';

export interface VaultRecord {
  id: string;
  name: string;
  createdAt: number;
  source: { type: ObsidianImportSourceType; originalName?: string };
  cloneOfVaultId?: string | null;
}

export type VaultNodeType = 'folder' | 'file';

export interface VaultNodeRecord {
  id: string;
  vaultId: string;
  path: string;
  type: VaultNodeType;
  parentId?: string;
}

export interface MarkdownHeadingIndex {
  depth: number;
  text: string;
  slug: string;
  line: number;
}

export interface MarkdownFileRecord {
  nodeId: string;
  vaultId: string;
  content: string;
  frontmatterRaw?: string;
  frontmatter?: Record<string, unknown> | null;
  headingsIndex?: MarkdownHeadingIndex[];
  updatedAt: number;
  hash: string;
}

export interface AssetRecord {
  id: string;
  vaultId: string;
  path: string;
  mime: string;
  size: number;
  blobId: string;
}

export type LinkIndexType = 'wikilink' | 'embed';

export interface LinkIndexRecord {
  id: string;
  vaultId: string;
  fromNodeId: string;
  rawTarget: string;
  targetPath?: string;
  targetHeading?: string;
  alias?: string;
  type: LinkIndexType;
  ambiguous?: boolean;
}

export interface ParsedMarkdownLink {
  rawTarget: string;
  targetPathRaw: string;
  targetHeading?: string;
  alias?: string;
  type: LinkIndexType;
}

export interface ParsedMarkdownResult {
  content: string;
  frontmatterRaw?: string;
  frontmatter?: Record<string, unknown> | null;
  headingsIndex: MarkdownHeadingIndex[];
  links: ParsedMarkdownLink[];
  hash: string;
}

export interface ObsidianImportStats {
  scannedFiles: number;
  markdownCount: number;
  assetCount: number;
  assetBytes: number;
  linksCount: number;
  resolvedLinksCount: number;
  unresolvedLinksCount: number;
}

export interface VaultFileTreeNode {
  id: string;
  path: string;
  name: string;
  type: VaultNodeType;
  parentId?: string;
  children?: VaultFileTreeNode[];
}

export interface ObsidianImportProgress {
  phase: 'scan' | 'parse' | 'assets' | 'links' | 'done' | 'error';
  scanned?: number;
  total?: number;
  parsed?: number;
  storedBytes?: number;
  totalBytes?: number;
  resolved?: number;
  totalLinks?: number;
  message?: string;
}

export interface ObsidianImportResult {
  vaultId: string;
  vaultName: string;
  stats: ObsidianImportStats;
}

export interface ImportObsidianZipInput {
  type: 'zip';
  file: File;
}

export interface ImportObsidianFolderInput {
  type: 'folder';
  handle: FileSystemDirectoryHandle;
}

export type ImportObsidianInput = ImportObsidianZipInput | ImportObsidianFolderInput;
