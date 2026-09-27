import { test } from 'node:test';
import assert from 'node:assert/strict';
import { kind, parseMaven, parseNpm, table } from './report.mjs';

test('classifies major, minor and patch updates', () => {
  assert.equal(kind('3.5.16', '4.1.1'), 'major');
  assert.equal(kind('2.21.4', '2.22.3'), 'minor');
  assert.equal(kind('42.7.11', '42.7.13'), 'patch');
  assert.equal(kind('0.303.0', '0.400.0'), 'major', 'a 0.x minor bump can break');
  assert.equal(kind('1.5.5.Final', '1.6.3'), 'minor');
});

test('reads the Maven report, including wrapped lines, and shows Spring Boot once', () => {
  const text = [
    'The following dependencies in Dependencies have newer versions:',
    '  org.jsoup:jsoup ..................................... 1.21.2 -> 1.23.2',
    '  org.springframework.boot:spring-boot-starter-data-jpa ...',
    '                                                      3.5.16 -> 4.1.1',
    '  org.springframework.boot:spring-boot-starter-web ..... 3.5.16 -> 4.1.1',
    '  org.mapstruct:mapstruct ................... 1.5.5.Final -> 1.7.0.Beta2',
  ].join('\n');
  const rows = parseMaven(text);
  assert.deepEqual(rows.map((r) => r.name), ['Spring Boot (all starters)', 'org.jsoup:jsoup']);
  assert.equal(rows[0].latest, '4.1.1');
});

test('reads npm outdated output and skips pre-releases and up-to-date packages', () => {
  const json = JSON.stringify({
    react: { current: '18.3.1', wanted: '18.3.1', latest: '19.3.0' },
    vite: { current: '5.4.21', latest: '8.0.0-beta.1' },
    ws: { current: '8.22.0', latest: '8.22.0' },
  });
  assert.deepEqual(parseNpm(json).map((r) => r.name), ['react']);
});

test('lists majors first and says so when nothing is out of date', () => {
  const md = table('Admin app', [
    { name: 'ws', current: '8.21.3', latest: '8.22.0' },
    { name: 'react', current: '18.3.1', latest: '19.3.0' },
  ]);
  assert.ok(md.indexOf('react') < md.indexOf('ws'));
  assert.match(md, /🔴 major/);
  assert.match(table('Public site', []), /Everything is up to date/);
});
