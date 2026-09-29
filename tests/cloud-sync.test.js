const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const helperBlock = html.match(
  /\/\/ ── Cloud Sync Pure Helpers ──([\s\S]*?)\/\/ ── End Cloud Sync Pure Helpers ──/
);

assert.ok(helperBlock, 'cloud sync helper block should exist in index.html');

const context = {};
vm.createContext(context);
vm.runInContext(
  `${helperBlock[1]}\nthis.testApi={cloudStatePayload,stateFromCloud};`,
  context
);

const { cloudStatePayload, stateFromCloud } = context.testApi;

test('join never uploads local state and create uses an atomic transaction', () => {
  const joinBlock = html.match(/async function joinExistingHousehold[\s\S]*?(?=async function createNewHousehold)/);
  const createBlock = html.match(/async function createNewHousehold[\s\S]*?(?=function generateHouseholdId)/);

  assert.ok(joinBlock, 'join flow should exist');
  assert.ok(createBlock, 'create flow should exist');
  assert.match(joinBlock[0], /await ref\.once\('value'\)/);
  assert.doesNotMatch(joinBlock[0], /pushToFirebase/);
  assert.match(createBlock[0], /await ref\.transaction/);
});

test('joining a household makes cloud horse data authoritative', () => {
  const local = {
    horses: [{ id: 'local-horse' }],
    adjustments: { stale: 1 },
    supplements: { stale: true },
    season: 'summer'
  };
  const remote = {
    horses: [{ id: 'cloud-horse' }],
    season: 'winter',
    _ts: 123
  };
  const joined = stateFromCloud(local, remote);

  assert.deepEqual(Array.from(joined.horses, h => h.id), ['cloud-horse']);
  assert.deepEqual(Object.keys(joined.adjustments), []);
  assert.deepEqual(Object.keys(joined.supplements), []);
  assert.equal(joined.season, 'winter');
  assert.equal(joined._ts, 123);
});

test('legacy single winter forage remains migratable after joining', () => {
  const joined = stateFromCloud(
    { winterForages: ['teff_pellets'], winterForageRatios: { teff_pellets: 1 } },
    { winterForage: 'hay', _ts: 10 }
  );

  assert.deepEqual(Array.from(joined.winterForages), ['hay']);
  assert.equal(Object.hasOwn(joined, 'winterForageRatios'), false);
});

test('cloud payload includes all synchronized settings', () => {
  const payload = cloudStatePayload({
    horses: [{ id: 'skor' }],
    adjustments: { amount: 4 },
    supplements: { amino: true },
    season: 'winter',
    pastureMode: 'short',
    winterForages: ['hay', 'alfalfa_forage'],
    winterForageRatios: { hay: 0.75, alfalfa_forage: 0.25 }
  }, 999);

  assert.equal(payload._ts, 999);
  assert.deepEqual(Array.from(payload.horses, h => h.id), ['skor']);
  assert.equal(payload.winterForageRatios.hay, 0.75);
});
