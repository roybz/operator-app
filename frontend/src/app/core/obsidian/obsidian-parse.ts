import {
  LinkIndexType,
  MarkdownHeadingIndex,
  ParsedMarkdownLink,
  ParsedMarkdownResult,
} from './vault-types';

export function normalizeVaultPath(input: string) {
  return input
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/')
    .trim();
}

export function isIgnoredVaultPath(path: string) {
  const normalized = normalizeVaultPath(path);
  if (!normalized) return true;
  if (normalized.startsWith('.git/')) return true;
  if (normalized.startsWith('.obsidian/')) return true;
  if (normalized === '.DS_Store' || normalized.endsWith('/.DS_Store')) return true;
  return false;
}

export function isMarkdownPath(path: string) {
  return /\.md$/i.test(path);
}

export function inferMimeType(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'svg':
      return 'image/svg+xml';
    case 'pdf':
      return 'application/pdf';
    case 'mp3':
      return 'audio/mpeg';
    case 'mp4':
      return 'video/mp4';
    default:
      return 'application/octet-stream';
  }
}

export function hashString(input: string) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

export function simpleYamlFrontmatter(raw: string) {
  const parsed: Record<string, unknown> = {};
  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const [, key, valueRaw] = match;
    const value = valueRaw.trim();
    if (value === 'true') parsed[key] = true;
    else if (value === 'false') parsed[key] = false;
    else if (/^-?\d+(\.\d+)?$/.test(value)) parsed[key] = Number(value);
    else if (value.startsWith('[') && value.endsWith(']')) {
      parsed[key] = value
        .slice(1, -1)
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);
    } else {
      parsed[key] = value.replace(/^['"]|['"]$/g, '');
    }
  }
  return parsed;
}

function slugifyHeading(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-');
}

function parseWikilinks(content: string): ParsedMarkdownLink[] {
  const links: ParsedMarkdownLink[] = [];
  const regex = /(!)?\[\[([^[\]]+)\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content))) {
    const isEmbed = Boolean(match[1]);
    const inner = match[2].trim();
    if (!inner) continue;
    const [targetAndHeading, alias] = inner.split('|');
    const [targetPathRaw, targetHeading] = targetAndHeading.split('#');
    links.push({
      rawTarget: inner,
      targetPathRaw: targetPathRaw.trim(),
      targetHeading: targetHeading?.trim() || undefined,
      alias: alias?.trim() || undefined,
      type: isEmbed ? ('embed' as LinkIndexType) : ('wikilink' as LinkIndexType),
    });
  }
  return links;
}

export function parseObsidianMarkdown(content: string): ParsedMarkdownResult {
  let working = content;
  let frontmatterRaw: string | undefined;
  let frontmatter: Record<string, unknown> | null | undefined;
  if (working.startsWith('---\n')) {
    const end = working.indexOf('\n---', 4);
    if (end > 0) {
      frontmatterRaw = working.slice(4, end);
      frontmatter = simpleYamlFrontmatter(frontmatterRaw);
      working = working.slice(end + 4).replace(/^\n/, '');
    }
  }

  const headingsIndex: MarkdownHeadingIndex[] = [];
  const lines = working.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(/^(#{1,6})\s+(.+)$/);
    if (!m) continue;
    headingsIndex.push({
      depth: m[1].length,
      text: m[2].trim(),
      slug: slugifyHeading(m[2]),
      line: i + 1,
    });
  }

  return {
    content,
    frontmatterRaw,
    frontmatter: frontmatter ?? null,
    headingsIndex,
    links: parseWikilinks(working),
    hash: hashString(content),
  };
}

export interface ResolvedLinkResult {
  targetPath?: string;
  ambiguous?: boolean;
}

export function resolveObsidianLinkTarget(
  rawTarget: string,
  sourcePath: string,
  pathLookup: Map<string, string>,
  basenameLookup: Map<string, string[]>,
): ResolvedLinkResult {
  const normalizedTarget = normalizeVaultPath(rawTarget).replace(/\.md$/i, '');
  if (!normalizedTarget) return {};
  const sourceDir = sourcePath.includes('/')
    ? sourcePath.slice(0, sourcePath.lastIndexOf('/'))
    : '';
  const candidatePaths: string[] = [];

  if (normalizedTarget.includes('/')) {
    candidatePaths.push(normalizedTarget, `${normalizedTarget}.md`);
  } else {
    if (sourceDir) {
      candidatePaths.push(
        `${sourceDir}/${normalizedTarget}`,
        `${sourceDir}/${normalizedTarget}.md`,
      );
    }
    candidatePaths.push(normalizedTarget, `${normalizedTarget}.md`);
  }

  for (const candidate of candidatePaths.map(normalizeVaultPath)) {
    if (pathLookup.has(candidate.toLowerCase())) return { targetPath: candidate };
  }

  const basename = normalizedTarget.split('/').pop()?.toLowerCase() ?? '';
  const matches = basenameLookup.get(basename) ?? basenameLookup.get(`${basename}.md`) ?? [];
  if (matches.length === 1) return { targetPath: matches[0] };
  if (matches.length > 1) return { targetPath: matches[0], ambiguous: true };
  return {};
}
