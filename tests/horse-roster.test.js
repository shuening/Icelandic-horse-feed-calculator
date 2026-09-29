const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const defaultsBlock = html.match(/const DEFAULT_HORSES=([\s\S]*?);\n\n\/\/ ── Fixed Horse Roster Pure Helpers ──/);
const helperBlock = html.match(
  /\/\/ ── Fixed Horse Roster Pure Helpers ──([\s\S]*?)\/\/ ── End Fixed Horse Roster Pure Helpers ──/
);

assert.ok(defaultsBlock, 'fixed horse defaults should exist');
assert.ok(helperBlock, 'fixed horse roster helper should exist');

const context = {};
vm.createContext(context);
vm.runInContext(
  `const DEFAULT_HORSES=${defaultsBlock[1]};${helperBlock[1]}\nthis.testApi={DEFAULT_HORSES,normalizeHorseRoster};`,
  context
);

const { DEFAULT_HORSES, normalizeHorseRoster } = context.testApi;

test('fixed visible roster contains the six barn horses', () => {
  const visibleNames = DEFAULT_HORSES.filter(h => !h.hidden).map(h => h.name);
  assert.deepEqual(Array.from(visibleNames), ['Tenor', 'Uffie', 'Spoi', 'Gonay', 'Olaf', 'Skor']);
  assert.equal(DEFAULT_HORSES.find(h => h.id === 'odinn').hidden, true);
});

test('new horses use the requested defaults', () => {
  for (const id of ['gonay', 'olaf', 'skor']) {
    assert.equal(DEFAULT_HORSES.find(h => h.id === id).weight, 800);
  }
  assert.deepEqual(
    Array.from(DEFAULT_HORSES.find(h => h.id === 'skor').conditions),
    ['ppid', 'underweight']
  );
});

test('old state migrates to the fixed roster and removes unsupported horses', () => {
  const migrated = normalizeHorseRoster([
    { id: 'tenor', name: 'Tenor', weight: 725, conditions: ['senior'], hidden: true },
    { id: 'horse_old', name: 'Skor', weight: 810, conditions: ['ppid', 'underweight'] },
    { id: 'horse_extra', name: 'Not In Barn', weight: 800, conditions: ['healthy'] }
  ], DEFAULT_HORSES);

  assert.equal(migrated.length, 7);
  assert.equal(migrated.some(h => h.id === 'horse_extra'), false);
  assert.equal(migrated.find(h => h.id === 'tenor').weight, 725);
  assert.equal(migrated.find(h => h.id === 'tenor').hidden, false);
  assert.equal(migrated.find(h => h.id === 'skor').weight, 810);
  assert.equal(migrated.find(h => h.id === 'skor').name, 'Skor');
});

test('settings no longer exposes add or delete horse controls', () => {
  assert.doesNotMatch(html, /Add Horse/);
  assert.doesNotMatch(html, /Delete Horse/);
  assert.doesNotMatch(html, /window\.addHorse/);
  assert.doesNotMatch(html, /window\.deleteHorse/);
});
