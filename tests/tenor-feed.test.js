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
  `${helperBlock[1]}\nthis.testApi={getSeniorLowCarbPlan};`,
  context
);

const { getSeniorLowCarbPlan } = context.testApi;

test('Tenor moderate-work Senior Low Carb range follows the label', () => {
  const plan = getSeniorLowCarbPlan({
    weight: 700,
    activity: 'moderate',
    conditions: ['senior', 'teeth', 'pssm']
  });
  assert.deepEqual(Array.from(plan.range), [11.2, 12.6]);
  assert.equal(plan.recommended, 11.9);
});

test('Tenor feed range responds to activity changes', () => {
  assert.deepEqual(
    Array.from(getSeniorLowCarbPlan({ weight: 700, activity: 'light', conditions: [] }).range),
    [10.5, 11.9]
  );
  assert.deepEqual(
    Array.from(getSeniorLowCarbPlan({ weight: 700, activity: 'heavy', conditions: [] }).range),
    [12.6, 14]
  );
});

test('an underweight PPID horse starts at the upper label amount', () => {
  const plan = getSeniorLowCarbPlan({
    weight: 800,
    activity: 'moderate',
    conditions: ['ppid', 'underweight']
  });
  assert.deepEqual(Array.from(plan.range), [12.8, 14.4]);
  assert.equal(plan.recommended, 14.4);
});
