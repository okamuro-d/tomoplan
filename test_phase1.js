const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/app.js', 'utf8');

const els = {};
const mk = (id) => els[id] || (els[id] = {
  id, value: '', textContent: '', innerHTML: '', dataset: {}, children: [],
  classList: { add() {}, remove() {} }, addEventListener() {}, appendChild() {},
  getAttribute() { return null; }, querySelector() { return mk('q'); }
});
const sandbox = {
  console, Date, Math, JSON, setTimeout,
  window: { addEventListener() {}, location: { hash: '', origin: '', pathname: '' }, scrollTo() {} },
  localStorage: { getItem: () => null, setItem() {} },
  document: { addEventListener() {}, getElementById: mk, createElement: () => mk('x'), querySelector: () => null, querySelectorAll: () => [] },
  navigator: {}
};
vm.createContext(sandbox);
vm.runInContext(src + '\n;this.__t = { appState, addMonthWeekends, buildCandidate, getFilteredCandidates, parseTimeRange, resolveCandidateSchedule, defaultFilters, handleApplyBulkDates };', sandbox);
const t = sandbox.__t;
const assert = require('assert');

// quick add: each month's weekend days, only Sat/Sun, no past dates
mk('pickerTimeType').value = '夜 (19:00〜)';
const today = new Date(); today.setHours(0,0,0,0);
for (const off of [0, 1, 2]) {
  t.appState.newCandidates = [];
  t.addMonthWeekends(off);
  const first = new Date(today.getFullYear(), today.getMonth() + off, 1);
  assert(t.appState.newCandidates.length > 0 || off === 0, 'some added');
  t.appState.newCandidates.forEach(c => {
    const d = new Date(c.date + 'T00:00:00');
    assert([0, 6].includes(d.getDay()), 'weekend only ' + c.date);
    assert.strictEqual(d.getMonth(), first.getMonth(), 'month ' + c.date);
    assert(d >= today, 'not past');
    assert.strictEqual(c.start, '19:00');
  });
  console.log('offset', off, '->', t.appState.newCandidates.length, t.appState.newCandidates.map(c => c.text).slice(0, 2));
  const n = t.appState.newCandidates.length;
  t.addMonthWeekends(off); // duplicate run adds nothing
  assert.strictEqual(t.appState.newCandidates.length, n);
}

// filters
const mkC = (id) => ({ id, text: id });
t.appState.currentEvent = {
  id: 'e', candidates: ['a', 'b', 'c'].map(mkC),
  responses: [
    { id: 'r1', name: 'hero', answers: { a: 'ok', b: 'ok', c: 'triangle' } },
    { id: 'r2', name: 'x', answers: { a: 'ok', b: 'triangle', c: 'ng' } },
    { id: 'r3', name: 'y', answers: { a: 'ng', b: 'ok', c: 'ok' } }
  ]
};
const ids = () => t.getFilteredCandidates().map(c => c.id).join('');
t.appState.filters = t.defaultFilters();
assert.strictEqual(ids(), 'abc');
t.appState.filters.excludeNg = true; assert.strictEqual(ids(), 'b');
t.appState.filters = { ...t.defaultFilters(), minOk: 2 }; assert.strictEqual(ids(), 'ab');
t.appState.filters = { ...t.defaultFilters(), minOk: 3 }; assert.strictEqual(ids(), '');
t.appState.filters = { ...t.defaultFilters(), minOk: 3, countTri: true }; assert.strictEqual(ids(), 'b');
t.appState.filters = { ...t.defaultFilters(), people: ['r1'] }; assert.strictEqual(ids(), 'ab');
t.appState.filters = { ...t.defaultFilters(), people: ['r1', 'r3'] }; assert.strictEqual(ids(), 'b');
t.appState.filters = { ...t.defaultFilters(), people: ['r1', 'r3'], excludeNg: true, minOk: 2 }; assert.strictEqual(ids(), 'b');

// legacy candidate + parse
assert.deepStrictEqual(JSON.parse(JSON.stringify(t.parseTimeRange('10/24(土) 18:00〜20:00'))), { start: '18:00', end: '20:00' });
const legacy = t.resolveCandidateSchedule({ text: '10月16日(金) 夜 (19:00〜)' });
assert(/^\d{4}-10-16$/.test(legacy.date) && legacy.start === '19:00', JSON.stringify(legacy));
console.log('ALL OK');
