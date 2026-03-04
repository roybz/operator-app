import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const rootDir = process.cwd();
const sourceDir = join(rootDir, 'src', 'app');
const reportPath = join(rootDir, '..', 'docs', 'conventions-audit.md');
const validExtensions = new Set(['.ts', '.html', '.scss']);

const files = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      walk(full);
      continue;
    }
    const ext = full.slice(full.lastIndexOf('.'));
    if (validExtensions.has(ext)) {
      files.push(full);
    }
  }
}

walk(sourceDir);

const inlineStyleRegex = /\bstyle\s*=/g;
const dynamicStyleRegex = /\[style(?:\.[\w-]+)?\]/g;
const hardcodedColorRegex = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g;
const ariaRoleRegex = /\baria-[\w-]+\s*=|\brole\s*=\s*["'][^"']+["']/g;
const buttonWithoutTypeRegex = /<button(?![^>]*\btype\s*=)[^>]*>/g;

const totals = {
  files: files.length,
  inlineStyles: 0,
  dynamicStyles: 0,
  hardcodedColors: 0,
  ariaRoleAttrs: 0,
  buttonsWithoutType: 0,
};

const offenders = [];

for (const file of files) {
  const content = readFileSync(file, 'utf8');
  const inlineStyles = (content.match(inlineStyleRegex) ?? []).length;
  const dynamicStyles = (content.match(dynamicStyleRegex) ?? []).length;
  const hardcodedColors = (content.match(hardcodedColorRegex) ?? []).length;
  const ariaRoleAttrs = (content.match(ariaRoleRegex) ?? []).length;
  const buttonsWithoutType = (content.match(buttonWithoutTypeRegex) ?? []).length;

  totals.inlineStyles += inlineStyles;
  totals.dynamicStyles += dynamicStyles;
  totals.hardcodedColors += hardcodedColors;
  totals.ariaRoleAttrs += ariaRoleAttrs;
  totals.buttonsWithoutType += buttonsWithoutType;

  const score = inlineStyles + hardcodedColors + buttonsWithoutType;
  if (score > 0) {
    offenders.push({
      file: relative(join(rootDir, '..'), file).replaceAll('\\', '/'),
      inlineStyles,
      hardcodedColors,
      buttonsWithoutType,
      score,
    });
  }
}

offenders.sort((a, b) => b.score - a.score);
const topOffenders = offenders.slice(0, 15);
const generatedAt = new Date().toISOString();

const lines = [
  '# Conventions Audit',
  '',
  `Generated: ${generatedAt}`,
  '',
  '## Scope',
  '',
  `- Source root: \`frontend/src/app\``,
  `- Files scanned: **${totals.files}**`,
  '',
  '## Totals',
  '',
  `- Inline style attributes (\`style=\`): **${totals.inlineStyles}**`,
  `- Dynamic style bindings (\`[style]\` / \`[style.*]\`): **${totals.dynamicStyles}**`,
  `- Hardcoded color literals (\`#hex\`, \`rgb*\`, \`hsl*\`): **${totals.hardcodedColors}**`,
  `- Accessibility attribute usage (\`aria-*\` and \`role=\`): **${totals.ariaRoleAttrs}**`,
  `- Button elements missing explicit \`type\`: **${totals.buttonsWithoutType}**`,
  '',
  '## Top Files Requiring Convention Cleanup',
  '',
  '| File | Inline styles | Hardcoded colors | Buttons missing type |',
  '| --- | ---: | ---: | ---: |',
  ...topOffenders.map(
    (entry) =>
      `| \`${entry.file}\` | ${entry.inlineStyles} | ${entry.hardcodedColors} | ${entry.buttonsWithoutType} |`,
  ),
  '',
  '## Interpretation',
  '',
  '- This report is a static convention baseline, not a blocker-only gate.',
  '- Priority is to reduce inline styles and hardcoded colors in reusable/shared surfaces first.',
  '- Accessibility attributes are present across multiple surfaces, but this does not certify WCAG conformance.',
  '- WCAG conformance still requires manual keyboard/focus testing and contrast verification.',
];

writeFileSync(reportPath, `${lines.join('\n')}\n`, 'utf8');
console.log(`Convention audit written to ${reportPath}`);
