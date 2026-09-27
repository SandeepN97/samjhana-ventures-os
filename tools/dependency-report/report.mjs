#!/usr/bin/env node
/**
 * Builds the monthly "Dependency upgrades to plan" issue body.
 *
 * Reads the output of `npm outdated --json` and `npm audit --json` (per frontend) and of the Maven
 * versions plugin's display-dependency-updates, and prints Markdown: known security problems first,
 * then one table of upgrades per part of the app, each marked major / minor / patch.
 *
 * It also works out the issue's priority and writes it to --priority-out:
 *   critical  a known security problem in a library the live site runs: fix now
 *   medium    a known security problem only in developer/build tools (not shipped to users)
 *   low       nothing insecure, just newer versions: upgrade when convenient
 *
 * Usage: node report.mjs --maven mvn.txt --priority-out priority.txt \
 *          --npm "Admin app=admin.json" --audit "Admin app=admin-audit.json=admin-audit-prod.json"
 * where the two audit files come from `npm audit --json` and `npm audit --omit=dev --json`.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const args = process.argv.slice(2);
const mavenFile = args[args.indexOf('--maven') + 1];
const specs = (flag) => args.flatMap((a, i) => (a === flag ? [args[i + 1]] : []))
  .map((spec) => { const [label, ...files] = spec.split('='); return { label, files }; });
const npmFiles = specs('--npm');
const auditFiles = specs('--audit');
const priorityOut = args.includes('--priority-out') ? args[args.indexOf('--priority-out') + 1] : null;

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

const SEVERITY = { critical: 0, high: 1, moderate: 2, low: 3, info: 4 };

/** Known security problems from `npm audit --json`; `live` = also in the `--omit=dev` audit. */
export function parseAudit(allJson, prodJson) {
  const all = JSON.parse(allJson || '{}').vulnerabilities || {};
  const prod = JSON.parse(prodJson || '{}').vulnerabilities || {};
  return Object.values(all).map((v) => {
    const advisory = (v.via || []).find((x) => typeof x === 'object');
    const fix = v.fixAvailable;
    return {
      name: v.name,
      severity: v.severity,
      live: Boolean(prod[v.name]),
      title: (advisory ? advisory.title : `via ${(v.via || []).join(', ')}`).replace(/\|/g, '\\|'),
      url: advisory ? advisory.url : null,
      fix: fix === true ? 'npm audit fix'
        : fix && fix.name ? `${fix.name} ${fix.version}${fix.isSemVerMajor ? ' (major upgrade)' : ''}`
          : 'no fix yet',
    };
  }).sort((a, b) => Number(b.live) - Number(a.live) || SEVERITY[a.severity] - SEVERITY[b.severity]
    || a.name.localeCompare(b.name));
}

export function priority(problems) {
  if (problems.some((p) => p.live)) return 'critical';
  if (problems.length) return 'medium';
  return 'low';
}

export function securityTable(label, problems) {
  if (!problems.length) return '';
  return [
    `### ${label}`,
    '| Library | Severity | Where | Problem | Fix |',
    '|---|---|---|---|---|',
    ...problems.map((p) => `| \`${p.name}\` | ${p.severity} | ${p.live ? '🚨 live site' : 'dev tools only'} | `
      + `${p.url ? `[${p.title}](${p.url})` : p.title} | ${p.fix} |`),
    '',
  ].join('\n');
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

export const PRIORITY_TEXT = {
  critical: '🚨 **Priority: critical.** A library the live site runs has a known security problem. Fix it now.',
  medium: '🟠 **Priority: medium.** A developer/build tool has a known security problem. It is not shipped to users; fix it in the next few weeks.',
  low: '⚪ **Priority: low.** No known security problems, just newer versions. Upgrade when convenient.',
};

function main() {
  const problemsBySection = auditFiles.map(({ label, files: [all, prod] }) => ({
    label,
    problems: existsSync(all) ? parseAudit(readFileSync(all, 'utf8'), existsSync(prod) ? readFileSync(prod, 'utf8') : '{}') : [],
  }));
  const level = priority(problemsBySection.flatMap((s) => s.problems));
  if (priorityOut) writeFileSync(priorityOut, level);

  const security = problemsBySection.map((s) => securityTable(s.label, s.problems)).filter(Boolean);
  const sections = [];
  if (mavenFile && existsSync(mavenFile)) sections.push(table('Backend (Maven)', parseMaven(readFileSync(mavenFile, 'utf8'))));
  for (const { label, files: [file] } of npmFiles) {
    if (existsSync(file)) sections.push(table(label, parseNpm(readFileSync(file, 'utf8'))));
  }
  const date = new Date().toISOString().slice(0, 10);
  process.stdout.write([
    `_Updated ${date} by the monthly dependency report. This issue is edited in place each month; close it once you've read it and a fresh one opens next month if anything is still out of date._`,
    '',
    PRIORITY_TEXT[level],
    '',
    '## Known security problems',
    security.length ? security.join('\n') : 'None found in the frontends.\n',
    '_Backend (Java) security problems are reported by Dependabot alerts, which open a PR labelled `priority: critical` as soon as a fix exists._',
    '',
    '## Upgrades to plan',
    '- 🟢 **patch** / 🟡 **minor**: usually safe; take them in one small PR when convenient.',
    '- 🔴 **major**: can break the app; plan it as its own piece of work.',
    '',
    ...sections,
  ].join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
