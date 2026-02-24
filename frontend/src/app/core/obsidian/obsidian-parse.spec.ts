import {
  normalizeVaultPath,
  parseObsidianMarkdown,
  resolveObsidianLinkTarget,
} from './obsidian-parse';

describe('obsidian-parse', () => {
  it('parses frontmatter, headings, and wikilinks', () => {
    const content = `---\ntitle: Test\ntags: [a, b]\n---\n# Heading\nSee [[Folder/Note#Part|Alias]] and ![[img.png]].`;
    const parsed = parseObsidianMarkdown(content);
    expect(parsed.frontmatter?.['title']).toBe('Test');
    expect(Array.isArray(parsed.frontmatter?.['tags'])).toBe(true);
    expect(parsed.headingsIndex.length).toBe(1);
    expect(parsed.headingsIndex[0].text).toBe('Heading');
    expect(parsed.links.length).toBe(2);
    expect(parsed.links[0].type).toBe('wikilink');
    expect(parsed.links[0].targetPathRaw).toBe('Folder/Note');
    expect(parsed.links[0].targetHeading).toBe('Part');
    expect(parsed.links[0].alias).toBe('Alias');
    expect(parsed.links[1].type).toBe('embed');
    expect(parsed.links[1].targetPathRaw).toBe('img.png');
  });

  it('resolves links by exact path and basename fallback', () => {
    const pathLookup = new Map<string, string>([
      ['folder/alpha', '1'],
      ['notes/beta', '2'],
    ]);
    const basenameLookup = new Map<string, string[]>([
      ['alpha', ['Folder/Alpha.md']],
      ['beta', ['Notes/Beta.md']],
    ]);

    expect(
      resolveObsidianLinkTarget('Folder/Alpha', 'Root/Current.md', pathLookup, basenameLookup),
    ).toEqual({ targetPath: 'Folder/Alpha' });

    expect(
      resolveObsidianLinkTarget('Beta', 'Root/Current.md', pathLookup, basenameLookup),
    ).toEqual({ targetPath: 'Notes/Beta.md' });
  });

  it('normalizes Windows-style paths', () => {
    expect(normalizeVaultPath('.\\\\Folder\\\\Sub\\\\Note.md')).toBe('Folder/Sub/Note.md');
  });
});
