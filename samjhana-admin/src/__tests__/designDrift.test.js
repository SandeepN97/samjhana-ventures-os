/* eslint-env node */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import webTailwind from '../../../samjhana-web/tailwind.config.js';
import { DESIGN_SYSTEM_DIR, compareDrift, measureDrift, webTokenHexes } from './designSystemMetrics';

/**
 * "No new drift": the numbers in design-system/drift-baseline.json are what the two apps contain today.
 * New code may not make them bigger, so new screens use the named colours and tokens, and the screens that
 * already exist are left exactly as they are. See design-system/CONSISTENCY.md.
 */
const baseline = JSON.parse(fs.readFileSync(path.join(DESIGN_SYSTEM_DIR, 'drift-baseline.json'), 'utf8'));

describe('design drift guard', () => {
  it('finds no new off-palette or hard-coded colours in either app', () => {
    const now = measureDrift({ webTokens: webTokenHexes(webTailwind) });
    expect(compareDrift(now, baseline), 'Colour drift grew').toEqual([]);
  });

  it('has a baseline that measures something real', () => {
    const now = measureDrift({ webTokens: webTokenHexes(webTailwind) });
    expect(now.web.hexLiterals).toBeGreaterThan(100);
    expect(now.web.hexLiteralsEqualToToken).toBeGreaterThan(0);
    expect(baseline.admin.offPaletteClassUses).toBeGreaterThan(0);
  });
});

describe('compareDrift', () => {
  const allowed = { admin: { offPaletteClassUses: 28, hexLiterals: 60 }, web: { hexLiterals: 700 } };

  it('passes when nothing grew, and when something shrank', () => {
    expect(compareDrift(allowed, allowed)).toEqual([]);
    expect(compareDrift({ admin: { offPaletteClassUses: 3, hexLiterals: 10 }, web: { hexLiterals: 1 } }, allowed)).toEqual([]);
  });

  it('names every number that grew, with advice and how to override', () => {
    const problems = compareDrift({ admin: { offPaletteClassUses: 29, hexLiterals: 60 }, web: { hexLiterals: 701 } }, allowed);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toContain('admin.offPaletteClassUses is 29, above the allowed 28');
    expect(problems[0]).toContain('design-system/TOKENS.md');
    expect(problems[1]).toContain('web.hexLiterals is 701, above the allowed 700');
    expect(problems[1]).toContain('drift-baseline.json');
  });

  it('fails when a number cannot be measured, instead of passing silently', () => {
    expect(compareDrift({ admin: {}, web: { hexLiterals: 1 } }, allowed)).toEqual([
      'admin.offPaletteClassUses could not be measured.',
      'admin.hexLiterals could not be measured.',
    ]);
  });
});
