const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const helperBlock = html.match(
  /\/\/ ── Winter Fiber Pure Helpers ──([\s\S]*?)\/\/ ── End Winter Fiber Pure Helpers ──/
);

assert.ok(helperBlock, 'winter fiber helper block should exist in index.html');

const context = {};
vm.createContext(context);
vm.runInContext(
  `${helperBlock[1]}\nthis.testApi={normalizeForageRatios,normalizeWinterForageState,allocateForageAmounts};`,
  context
);

const {
  normalizeWinterForageState,
  allocateForageAmounts
} = context.testApi;

test('single forage receives the full amount', () => {
  const amounts = allocateForageAmounts(['grass_hay'], 12.3, { grass_hay: 0.2 });
  assert.deepEqual({ ...amounts }, { grass_hay: 12.3 });
});

test('multiple forages follow normalized custom ratios and preserve the total', () => {
  const amounts = allocateForageAmounts(
    ['teff_pellets', 'grass_hay', 'alfalfa_forage'],
    10,
    { teff_pellets: 60, grass_hay: 30, alfalfa_forage: 10 }
  );
  assert.deepEqual(
    { ...amounts },
    { teff_pellets: 6, grass_hay: 3, alfalfa_forage: 1 }
  );
});

test('old states migrate to equal split without losing forage selections', () => {
  const oldMulti = normalizeWinterForageState({
    winterForages: ['teff_pellets', 'grass_hay', 'alfalfa_forage']
  });
  assert.deepEqual(Array.from(oldMulti.winterForages), [
    'teff_pellets',
    'grass_hay',
    'alfalfa_forage'
  ]);
  assert.deepEqual(
    { ...oldMulti.winterForageRatios },
    { teff_pellets: 0.333, grass_hay: 0.333, alfalfa_forage: 0.334 }
  );
  assert.deepEqual(
    { ...allocateForageAmounts(oldMulti.winterForages, 10, oldMulti.winterForageRatios) },
    { teff_pellets: 3.3, grass_hay: 3.3, alfalfa_forage: 3.4 }
  );

  const oldSingle = normalizeWinterForageState({ winterForage: 'grass_hay' });
  assert.deepEqual(Array.from(oldSingle.winterForages), ['grass_hay']);
  assert.deepEqual({ ...oldSingle.winterForageRatios }, { grass_hay: 1 });
  assert.equal('winterForage' in oldSingle, false);
});
