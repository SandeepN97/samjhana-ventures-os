#!/usr/bin/env node
/**
 * Builds the monthly "Dependency upgrades to plan" issue body.
 *
 * Reads the output of `npm outdated --json` (one file per frontend) and of the Maven versions
 * plugin's display-dependency-updates, and prints Markdown: one table per part of the app, each
 * update marked major / minor / patch. Security fixes are NOT this report's job: Dependabot security
 * updates open a PR for those straight away.
 *
 * Usage: node report.mjs --maven mvn.txt --npm "Admin app=admin.json" --npm "Public site=web.json"
 */
import { readFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const mavenFile = args[args.indexOf('--maven') + 1];
const npmFiles = args.flatMap((a, i) => (a === '--npm' ? [args[i + 1]] : []))
  .map((spec) => { const [label, file] = spec.split('='); return { label, file }; });

const PRE_RELEASE = /[-.](alpha|beta|m|rc|cr|snapshot)[-.]?\d*$/i;

export function kind(current, latest) {
  const a = String(current).replace(/^[^\d]*/, '').split(/[.-]/).map(Number);
  const b = String(latest).replace(/^[^\d]*/, '').split(/[.-]/).map(Number);
  if ((b[0] || 0) !== (a[0] || 0)) return 'major';
  if ((b[1] || 0) !== (a[1] || 0)) return (a[0] || 0) === 0 ? 'major' : 'minor';   // 0.x: minor bumps break
  return 'patch';
}

export function parseMaven(text) {
  // Lines look like "  group:artifact ....... 1.2.3 -> 1.3.0", sometimes wrapped onto a second line.
  const joined = text.replace(/\.\.\.\s*\n\s+/g, '... ');
  const rows = [];
  for (const m of joined.matchAll(/^\s+([\w.-]+:[\w.-]+)\s*\.*\s*(\S+)\s+->\s+(\S+)\s*$/gm)) {
    const [, name, current, latest] = m;
    if (PRE_RELEASE.test(latest)) continue;
    rows.push({ name, current, latest });
  }
  // Spring Boot starters all move together: show them once.
  const boot = rows.filter((r) => r.name.startsWith('org.springframework.boot:'));
  const rest = rows.filter((r) => !r.name.startsWith('org.springframework.boot:'));
  if (boot.length) rest.unshift({ ...boot[0], name: 'Spring Boot (all starters)' });
  return rest;
}

export function parseNpm(json) {
  const data = JSON.parse(json || '{}');
  return Object.entries(data)
    .filter(([, v]) => v.current && v.latest && v.current !== v.latest && !PRE_RELEASE.test(v.latest))
    .map(([name, v]) => ({ name, current: v.current, latest: v.latest }));
}

export function table(label, rows) {
  if (!rows.length) return `### ${label}\nEverything is up to date.\n`;
  const order = { major: 0, minor: 1, patch: 2 };
  const sorted = rows.map((r) => ({ ...r, kind: kind(r.current, r.latest) }))
    .sort((x, y) => order[x.kind] - order[y.kind] || x.name.localeCompare(y.name));
  const icon = { major: '🔴 major', minor: '🟡 minor', patch: '🟢 patch' };
  return [
    `### ${label}`,
    '| Package | Now | Latest | Type |',
    '|---|---|---|---|',
    ...sorted.map((r) => `| \`${r.name}\` | ${r.current} | ${r.latest} | ${icon[r.kind]} |`),
    '',
  ].join('\n');
}

function main() {
  const sections = [];
  if (mavenFile && existsSync(mavenFile)) sections.push(table('Backend (Maven)', parseMaven(readFileSync(mavenFile, 'utf8'))));
  for (const { label, file } of npmFiles) {
    if (existsSync(file)) sections.push(table(label, parseNpm(readFileSync(file, 'utf8'))));
  }
  const date = new Date().toISOString().slice(0, 10);
  process.stdout.write([
    `_Updated ${date} by the monthly dependency report. This issue is edited in place each month; close it once you've read it and a fresh one opens next month if anything is still out of date._`,
    '',
    '**How to read this**',
    '- 🟢 **patch** / 🟡 **minor**: usually safe; take them in one small PR when convenient.',
    '- 🔴 **major**: can break the app; plan it as its own piece of work.',
    '- **Security fixes are not listed here**: Dependabot opens a PR for those as soon as they are published.',
    '',
    ...sections,
  ].join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
