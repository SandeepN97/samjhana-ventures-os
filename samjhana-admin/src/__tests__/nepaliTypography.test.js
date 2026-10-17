import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'index.css'), 'utf8');

// Every rule block outside @font-face / :root, as [selector, body].
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => [selector.trim(), body]);

describe('Nepali typography', () => {
  it('only applies the Nepali fonts while the page language is Nepali', () => {
    const using = rules.filter(([, body]) => /var\(--font-ne-/.test(body));
    expect(using.length).toBeGreaterThan(0);
    using.forEach(([selector]) => {
      selector.split(',').forEach((part) => expect(part.trim()).toMatch(/^html\[lang="ne"\]/));
    });
  });

  it('keeps Yatra One and Kalimati as the established Nepali chrome fonts', () => {
    expect(css).toMatch(/--font-ne-heading:\s*'Yatra One'/);
    expect(css).toMatch(/--font-ne-body:\s*'Kalimati'/);
    const headings = rules.find(([selector]) => selector.includes('html[lang="ne"] h1'));
    expect(headings[1]).toContain('var(--font-ne-heading)');
    const body = rules.find(([selector]) => selector.includes('html[lang="ne"] body'));
    ['button', 'input', 'select', 'textarea', 'Red_Hat_Text'].forEach((part) => expect(body[0]).toContain(part));
  });

  it('uses Mukta only for desktop main content and restores the chrome fonts in top headers', () => {
    expect(css).toMatch(/--font-ne-content:\s*'Mukta'/);
    expect(css).toMatch(/@media\s*\(min-width:\s*1024px\)/);
    const content = rules.find(([selector]) => selector.includes('html[lang="ne"] .desktop-main-content h1'));
    expect(content[1]).toContain('var(--font-ne-content)');
    const headerBody = rules.find(([selector]) => selector.includes('html[lang="ne"] .desktop-main-content header *'));
    expect(headerBody[1]).toContain('var(--font-ne-body)');
    const headerHeading = rules.find(([selector]) => selector.includes('html[lang="ne"] .desktop-main-content header h1'));
    expect(headerHeading[1]).toContain('var(--font-ne-heading)');
  });

  it('increases the desktop Mukta scale while leaving top headers at their original size', () => {
    const content = rules.find(([selector]) => selector === 'html[lang="ne"] .desktop-main-content');
    expect(content[1]).toContain('--font-ne-content-scale: 1.08');
    expect(content[1]).toContain('font-size: calc(1rem * var(--font-ne-content-scale))');
    ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl'].forEach((size) => {
      const rule = rules.find(([selector]) => selector === `html[lang="ne"] .desktop-main-content .${size}`);
      expect(rule[1]).toContain('var(--font-ne-content-scale)');
    });
    const header = rules.find(([selector]) => selector === 'html[lang="ne"] .desktop-main-content header');
    expect(header[1]).toContain('--font-ne-content-scale: 1');
    expect(header[1]).toContain('font-size: 1rem');
  });

  it('falls back to another Devanagari font and the system font if either fails to load', () => {
    const vars = css.match(/--font-ne-(?:heading|body|content):[^;]+;/g).join(' ');
    expect(vars).toContain('Noto Sans Devanagari');
    expect(vars).toContain('system-ui');
  });

  it('serves Kalimati from this app with a font that is really there, and shows text while it loads', () => {
    const face = css.match(/@font-face\s*\{[^}]*Kalimati[^}]*\}/)[0];
    expect(face).toContain('font-display: swap');
    const file = path.join(root, 'assets/fonts/Kalimati.ttf');
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file).subarray(0, 4).toString('hex')).toBe('00010000');
  });

  it('does not stack a Google Fonts link, which the production security policy would block', () => {
    expect(css).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/);
    expect(fs.readFileSync(path.resolve(root, '../index.html'), 'utf8')).not.toMatch(/fonts\.googleapis\.com/);
  });
});
