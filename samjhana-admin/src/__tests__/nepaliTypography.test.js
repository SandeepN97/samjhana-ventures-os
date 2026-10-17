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

  it('gives headings Yatra One and the rest Kalimati', () => {
    expect(css).toMatch(/--font-ne-heading:\s*'Yatra One'/);
    expect(css).toMatch(/--font-ne-body:\s*'Kalimati'/);
    const headings = rules.find(([selector]) => selector.includes('html[lang="ne"] h1'));
    expect(headings[1]).toContain('var(--font-ne-heading)');
    const body = rules.find(([selector]) => selector.includes('html[lang="ne"] body'));
    ['button', 'input', 'select', 'textarea', 'Red_Hat_Text'].forEach((part) => expect(body[0]).toContain(part));
  });

  it('falls back to another Devanagari font and the system font if either fails to load', () => {
    const vars = css.match(/--font-ne-(?:heading|body):[^;]+;/g).join(' ');
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
