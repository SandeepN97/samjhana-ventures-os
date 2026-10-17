/* eslint-env node */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import colors from 'tailwindcss/colors';
import adminTailwind from '../../tailwind.config.js';
import webTailwind from '../../../samjhana-web/tailwind.config.js';
import { UNIT_THEMES, STATUS_STYLES } from '../brand/theme';
import { DESIGN_SYSTEM_DIR, REPO_ROOT, markdownFiles, validateTokens } from './designSystemMetrics';
import { componentList, renderIndex, renderTokensMarkdown } from '../../../design-system/build.mjs';

/**
 * The design system in /design-system describes what the two apps look like today. These tests keep it true:
 * change a colour, a font or a business accent in the code without updating design-system/tokens.json and they fail.
 */
const tokens = JSON.parse(fs.readFileSync(path.join(DESIGN_SYSTEM_DIR, 'tokens.json'), 'utf8'));
const colorValue = new Map(tokens.color.tokens.map((token) => [token.name, token.value[tokens.color.themes[0].id].toLowerCase()]));
const accents = adminTailwind.theme.extend.colors;
const web = webTailwind.theme.extend.colors;

describe('tokens.json file', () => {
  it('follows the Claude Design System shape with no problems', () => {
    expect(validateTokens(tokens)).toEqual([]);
  });

  it('is reported when it is malformed', () => {
    const broken = {
      name: 'Broken',
      color: {
        themes: [{ id: 'light', name: 'Light' }],
        tokens: [
          { name: 'same', value: { light: '#112233' }, usage: 'first' },
          { name: 'same', value: { light: '#445566' }, usage: 'second' },
          { name: 'not valid!', value: { light: '#778899' }, usage: 'bad name' },
          { name: 'no-hex', value: { light: 'red' }, usage: 'named colour' },
          { name: 'no-usage', value: { light: '#aabbcc' }, usage: '' },
        ],
      },
      type: { families: {} },
    };
    const problems = validateTokens(broken).join('\n');
    expect(problems).toContain('"same" is used more than once');
    expect(problems).toContain('"not valid!" is not a valid token name');
    expect(problems).toContain('"no-hex" has no valid hex value');
    expect(problems).toContain('"no-usage" has no usage note');
    expect(problems).toContain('type.families is missing');
  });
});

describe('admin colours match the code', () => {
  it('names the same businesses in theme.js and the Tailwind config', () => {
    expect(Object.keys(UNIT_THEMES).sort()).toEqual(Object.keys(accents).sort());
  });

  it('documents every shade of every business colour that theme.js uses, with its exact value', () => {
    for (const [unit, theme] of Object.entries(UNIT_THEMES)) {
      const used = new Set();
      for (const classes of Object.values(theme)) {
        for (const match of classes.matchAll(new RegExp(`\\b${unit}-(\\d+)\\b`, 'g'))) used.add(match[1]);
      }
      expect(used.size, `${unit} uses no shades in theme.js`).toBeGreaterThan(0);
      for (const shade of used) {
        expect(colorValue.get(`admin-${unit}-${shade}`), `admin-${unit}-${shade} is missing or wrong in tokens.json`).toBe(
          accents[unit][shade].toLowerCase(),
        );
      }
    }
  });

  it('documents every status colour exactly', () => {
    for (const [tone, classes] of Object.entries(STATUS_STYLES)) {
      const [, backgroundFamily, backgroundShade] = classes.match(/bg-([a-z]+)-(\d+)/);
      const [, textFamily, textShade] = classes.match(/text-([a-z]+)-(\d+)/);
      expect(colorValue.get(`admin-status-${tone}-bg`), `admin-status-${tone}-bg`).toBe(colors[backgroundFamily][backgroundShade].toLowerCase());
      expect(colorValue.get(`admin-status-${tone}-text`), `admin-status-${tone}-text`).toBe(colors[textFamily][textShade].toLowerCase());
    }
  });
});

describe('public site tokens match the code', () => {
  it('documents the gold, dark and warm colours exactly', () => {
    const expected = {
      'web-gold': web.gold.DEFAULT,
      'web-gold-light': web.gold.light,
      'web-gold-pale': web.gold.pale,
      'web-dark': web.dark.DEFAULT,
      'web-dark-soft': web.dark.soft,
      'web-dark-muted': web.dark.muted,
      'web-warm': web.warm.DEFAULT,
      'web-warm-soft': web.warm.soft,
      'web-warm-border': web.warm.border,
    };
    for (const [name, hex] of Object.entries(expected)) {
      expect(colorValue.get(name), `${name} is missing or wrong in tokens.json`).toBe(hex.toLowerCase());
    }
  });

  it('documents the fonts and the warm gradient exactly', () => {
    const fonts = webTailwind.theme.extend.fontFamily;
    expect(tokens.type.families['web-serif']).toBe(fonts.serif.join(', '));
    expect(tokens.type.families['web-sans']).toBe(fonts.sans.join(', '));
    const gradient = tokens.gradient.tokens.find((token) => token.name === 'web-warm-gradient');
    expect(gradient.value).toBe(webTailwind.theme.extend.backgroundImage['warm-gradient']);
  });
});

describe('component guides and previews', () => {
  const componentsDir = path.join(DESIGN_SYSTEM_DIR, 'components');
  const names = fs.readdirSync(componentsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const inventory = fs.readFileSync(path.join(DESIGN_SYSTEM_DIR, 'INVENTORY.md'), 'utf8');

  it('exist for the admin kit and the public site', () => {
    expect(names.filter((name) => name.startsWith('Admin')).length).toBeGreaterThanOrEqual(10);
    expect(names.filter((name) => name.startsWith('Web')).length).toBeGreaterThanOrEqual(8);
  });

  it.each(names)('%s has a guide, a preview and a line in INVENTORY.md', (name) => {
    const guide = fs.readFileSync(path.join(componentsDir, name, 'README.md'), 'utf8');
    expect(guide.replace(/^#.*$/m, '').trim().length, `${name}/README.md has no text`).toBeGreaterThan(80);
    const preview = fs.readFileSync(path.join(componentsDir, name, 'preview.html'), 'utf8');
    expect(preview.split('\n')[0]).toMatch(/^<!-- @dsCard group="[^"]+" height=\d+ -->$/);
    expect(inventory, `${name} is not listed in INVENTORY.md`).toContain(`components/${name}/`);
  });

  it.each(names)('%s preview is static and loads only local files and Google Fonts', (name) => {
    const dir = path.join(componentsDir, name);
    const html = fs.readFileSync(path.join(dir, 'preview.html'), 'utf8');
    expect(html).not.toMatch(/<script/i);
    const wanted = name.startsWith('Admin') ? 'preview/admin.css' : 'preview/web.css';
    expect(html, `${name} should link ${wanted}`).toContain(wanted);
    for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^https?:\/\//.test(url)) {
        expect(new URL(url).host, `${name} loads ${url}`).toMatch(/^fonts\.(googleapis|gstatic)\.com$/);
      } else if (!/^(data:|#)/.test(url)) {
        expect(fs.existsSync(path.resolve(dir, url)), `${name} links ${url}, which does not exist`).toBe(true);
      }
    }
  });
});

describe('generated files', () => {
  it('TOKENS.md is written from tokens.json and up to date', () => {
    const upToDate = fs.readFileSync(path.join(DESIGN_SYSTEM_DIR, 'TOKENS.md'), 'utf8') === renderTokensMarkdown(tokens);
    expect(upToDate, 'TOKENS.md is out of date: run node design-system/build.mjs --docs').toBe(true);
  });

  it('index.html shows every component and every colour and is up to date', () => {
    const index = fs.readFileSync(path.join(DESIGN_SYSTEM_DIR, 'index.html'), 'utf8');
    for (const { name } of componentList(DESIGN_SYSTEM_DIR)) expect(index).toContain(`components/${name}/preview.html`);
    for (const token of tokens.color.tokens) expect(index).toContain(token.name);
    expect(index === renderIndex(tokens, componentList(DESIGN_SYSTEM_DIR)), 'index.html is out of date: run node design-system/build.mjs --docs').toBe(true);
  });
});

describe('design system folder', () => {
  it.each([
    'README.md', 'TOKENS.md', 'INVENTORY.md', 'CONSISTENCY.md', 'REVIEW.md', 'index.html', 'build.mjs',
    'assets/Logos/README.md', 'assets/Logos/grid-mark.svg', 'assets/Icons/README.md', 'fonts/README.md',
    'reference/shringashwor-concept.md', 'preview/admin.css', 'preview/web.css',
  ])('has %s', (file) => {
    expect(fs.existsSync(path.join(DESIGN_SYSTEM_DIR, file)), `design-system/${file} is missing (is it git-ignored?)`).toBe(true);
  });
});

describe('documents', () => {
  it('link only to files that exist', () => {
    for (const file of markdownFiles(DESIGN_SYSTEM_DIR)) {
      const text = fs.readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
      for (const [, target] of text.matchAll(/(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g)) {
        if (/^(https?:|mailto:|#)/.test(target)) continue;
        const resolved = path.resolve(path.dirname(file), target.split('#')[0]);
        expect(fs.existsSync(resolved), `${path.relative(REPO_ROOT, file)} links ${target}, which does not exist`).toBe(true);
      }
    }
  });

  it('are pointed to by CLAUDE.md, so every agent reads them before UI work', () => {
    const claude = fs.readFileSync(path.join(REPO_ROOT, 'CLAUDE.md'), 'utf8');
    expect(claude).toContain('design-system/README.md');
  });
});
