const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const helperBlock = html.match(
  /\/\/ ── Feed Plan Pure Helpers ──([\s\S]*?)\/\/ ── End Feed Plan Pure Helpers ──/
);

assert.ok(helperBlock, 'feed plan helper block should exist in index.html');

const context = {};
vm.createContext(context);
vm.runInContext(
  `${helperBlock[1]}\nthis.testApi={getTenorSeniorLowCarbRange};`,
  context
);

const { getTenorSeniorLowCarbRange } = context.testApi;

test('Tenor moderate-work Senior Low Carb range follows the label', () => {
  const range = getTenorSeniorLowCarbRange({ weight: 700, activity: 'moderate' });
  assert.deepEqual(Array.from(range), [11.2, 12.6]);
  assert.equal(Number(((range[0] + range[1]) / 2).toFixed(1)), 11.9);
});

test('Tenor feed range responds to activity changes', () => {
  assert.deepEqual(
    Array.from(getTenorSeniorLowCarbRange({ weight: 700, activity: 'light' })),
    [10.5, 11.9]
  );
  assert.deepEqual(
    Array.from(getTenorSeniorLowCarbRange({ weight: 700, activity: 'heavy' })),
    [12.6, 14]
  );
});
