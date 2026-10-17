/* eslint-env node */
/**
 * Helpers for the design-system tests (designSystem.test.js and designDrift.test.js).
 * They only read files; nothing here runs in the browser or changes how the apps look.
 *
 * Run it on its own to print today's drift numbers, the ones stored in design-system/drift-baseline.json:
 *   cd samjhana-admin && node src/__tests__/designSystemMetrics.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ADMIN_SRC = path.resolve(here, '..');
export const REPO_ROOT = path.resolve(here, '../../..');
export const WEB_SRC = path.join(REPO_ROOT, 'samjhana-web', 'src');
export const DESIGN_SYSTEM_DIR = path.join(REPO_ROOT, 'design-system');

/** Tailwind colour families that are neither a business accent nor one of the status colours. */
export const OFF_PALETTE_FAMILIES = [
  'emerald', 'violet', 'rose', 'purple', 'indigo', 'pink', 'cyan', 'sky', 'lime', 'fuchsia', 'teal', 'stone', 'zinc', 'neutral',
];
const OFF_PALETTE = new RegExp(
  `\\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|decoration|accent|shadow)-(?:${OFF_PALETTE_FAMILIES.join('|')})-\\d{2,3}\\b`,
  'g',
);
const HEX = /#[0-9a-fA-F]{6}\b/g;

const SKIPPED_DIRS = new Set(['node_modules', 'dist', '__tests__', 'test']);
const SOURCE_FILE = /\.(js|jsx|css)$/;
const TEST_FILE = /\.(test|spec)\./;

/** Every source file under `dir` that ships to users: no tests, no test helpers. */
export function sourceFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRS.has(entry.name)) found.push(...sourceFiles(full));
    } else if (SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name)) {
      found.push(full);
    }
  }
  return found;
}

function textOf(files) {
  return files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
}

/** Every Markdown file under `dir`. */
export function markdownFiles(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...markdownFiles(full));
    else if (entry.name.endsWith('.md')) found.push(full);
  }
  return found;
}

/** The hex values of the public site's colour tokens (lower case), from its Tailwind config. */
export function webTokenHexes(webTailwind) {
  const hexes = new Set();
  for (const family of Object.values(webTailwind.theme.extend.colors)) {
    for (const value of Object.values(family)) hexes.add(String(value).toLowerCase());
  }
  return hexes;
}

/** Today's numbers. Each can only stay the same or go down (see design-system/CONSISTENCY.md). */
export function measureDrift({ adminSrc = ADMIN_SRC, webSrc = WEB_SRC, webTokens }) {
  const admin = textOf(sourceFiles(adminSrc));
  const web = textOf(sourceFiles(webSrc));
  const adminHex = admin.match(HEX) ?? [];
  const webHex = web.match(HEX) ?? [];
  return {
    admin: {
      offPaletteClassUses: (admin.match(OFF_PALETTE) ?? []).length,
      hexLiterals: adminHex.length,
      distinctHexLiterals: new Set(adminHex.map((hex) => hex.toLowerCase())).size,
    },
    web: {
      hexLiterals: webHex.length,
      distinctHexLiterals: new Set(webHex.map((hex) => hex.toLowerCase())).size,
      hexLiteralsEqualToToken: webHex.filter((hex) => webTokens.has(hex.toLowerCase())).length,
    },
  };
}

const ADVICE = {
  offPaletteClassUses: 'Use a business colour or a status colour from design-system/TOKENS.md instead of emerald, violet, rose, purple and similar.',
  hexLiterals: 'Use a named colour (a Tailwind class or a token) instead of a new hard-coded hex value.',
  distinctHexLiterals: 'Use a colour that is already in design-system/TOKENS.md instead of a new hex value.',
  hexLiteralsEqualToToken: 'Use the token class (text-gold, bg-dark, bg-warm ...) instead of repeating its hex value.',
};
const OVERRIDE = 'If the higher number is deliberate, raise it in design-system/drift-baseline.json in the same PR and say why in the PR description.';

/** Problems found by comparing today's numbers with the stored ones; empty when nothing grew. */
export function compareDrift(now, baseline) {
  const problems = [];
  for (const [area, metrics] of Object.entries(baseline)) {
    if (area.startsWith('_')) continue;
    for (const [metric, allowed] of Object.entries(metrics)) {
      const value = now?.[area]?.[metric];
      if (typeof value !== 'number') {
        problems.push(`${area}.${metric} could not be measured.`);
      } else if (value > allowed) {
        problems.push(`${area}.${metric} is ${value}, above the allowed ${allowed}. ${ADVICE[metric] ?? ''} ${OVERRIDE}`.replace(/ {2,}/g, ' '));
      }
    }
  }
  return problems;
}

const TOKEN_NAME = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const COLOR_VALUE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** Problems with a tokens.json in the Claude Design System shape; empty when it is sound. */
export function validateTokens(tokens) {
  const problems = [];
  if (!tokens || typeof tokens !== 'object') return ['tokens.json is not an object.'];
  if (!tokens.name) problems.push('name is missing.');
  const themes = tokens.color?.themes;
  if (!Array.isArray(themes) || themes.length === 0) problems.push('color.themes must list at least one theme.');
  const themeId = themes?.[0]?.id;
  const seen = new Set();
  const checkName = (name, where) => {
    if (!TOKEN_NAME.test(name ?? '')) problems.push(`${where}: "${name}" is not a valid token name.`);
    else if (seen.has(name)) problems.push(`${where}: "${name}" is used more than once.`);
    seen.add(name);
  };
  for (const token of tokens.color?.tokens ?? []) {
    checkName(token.name, 'color');
    const value = token.value?.[themeId];
    if (!COLOR_VALUE.test(value ?? '')) problems.push(`color: "${token.name}" has no valid hex value in theme "${themeId}".`);
    if (!String(token.usage ?? '').trim()) problems.push(`color: "${token.name}" has no usage note.`);
  }
  for (const family of ['spacing', 'radius', 'shadow', 'gradient']) {
    for (const token of tokens[family]?.tokens ?? []) {
      checkName(token.name, family);
      if (!String(token.value ?? '').trim()) problems.push(`${family}: "${token.name}" has no value.`);
      if (!String(token.usage ?? '').trim()) problems.push(`${family}: "${token.name}" has no usage note.`);
    }
  }
  if (!tokens.type?.families || Object.keys(tokens.type.families).length === 0) problems.push('type.families is missing.');
  return problems;
}

// Running this file directly prints the numbers for drift-baseline.json.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const webConfig = (await import(pathToFileURL(path.join(REPO_ROOT, 'samjhana-web', 'tailwind.config.js')))).default;
  console.log(JSON.stringify(measureDrift({ webTokens: webTokenHexes(webConfig) }), null, 2));
}
