const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const src = fs.readFileSync('C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/app.js', 'utf8');

const els = {};
const mk = (id) => els[id] || (els[id] = {
  id, value: '', textContent: '', innerHTML: '', dataset: {}, children: [],
  classList: {
    add() {}, remove() {}, toggle() {}
  },
  addEventListener() {}, appendChild() {},
  getAttribute() { return null; },
  setAttribute() {},
  querySelector() { return mk('q'); },
  querySelectorAll() { return [mk('q1'), mk('q2'), mk('q3')]; }
});

const sandbox = {
  console, Date, Math, JSON, setTimeout,
  btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
  atob: (str) => Buffer.from(str, 'base64').toString('binary'),
  window: { addEventListener() {}, location: { hash: '', origin: '', pathname: '' }, scrollTo() {} },
  localStorage: { getItem: () => null, setItem() {} },
  document: {
    addEventListener() {},
    getElementById: mk,
    createElement: () => mk('x'),
    querySelector: () => mk('qs'),
    querySelectorAll: () => []
  },
  navigator: {}
};

vm.createContext(sandbox);
vm.runInContext(src + '\n;this.__t = { appState, addMembersFromString, removeMember, toggleRequiredMember, getDeadReason, normalizeRules, normalizeName, loadDemoData };', sandbox);
const t = sandbox.__t;

// Test 1: Member addition with comma/spaces
console.log('Testing Member Addition...');
t.appState.newMembers = [];
t.appState.newRules.requiredNames = [];
t.addMembersFromString('さくら, けんた、ダイキ　ゆい');
assert.strictEqual(t.appState.newMembers.length, 4);
assert.deepStrictEqual(t.appState.newMembers, ['さくら', 'けんた', 'ダイキ', 'ゆい']);

// Duplicate addition should be ignored
t.addMembersFromString('さくら, たなか');
assert.strictEqual(t.appState.newMembers.length, 5); // +たなか only
assert(t.appState.newMembers.includes('たなか'));
console.log('Member addition and deduplication passed.');

// Test 2: Required members toggle from members
console.log('Testing Required Member Toggle...');
t.toggleRequiredMember('さくら');
assert.strictEqual(t.appState.newRules.requiredNames.length, 1);
assert.strictEqual(t.appState.newRules.requiredNames[0], 'さくら');

t.toggleRequiredMember('けんた');
assert.strictEqual(t.appState.newRules.requiredNames.length, 2);

// Toggle off 'さくら'
t.toggleRequiredMember('さくら');
assert.strictEqual(t.appState.newRules.requiredNames.length, 1);
assert.strictEqual(t.appState.newRules.requiredNames[0], 'けんた');

// Removing member should also remove from requiredNames
t.removeMember('けんた');
assert(!t.appState.newMembers.includes('けんた'));
assert(!t.appState.newRules.requiredNames.includes('けんた'));
console.log('Required member toggle and member removal sync passed.');

// Test 3: Demo event has members and required
console.log('Testing Demo Event Members...');
t.loadDemoData();
const demo = t.appState.currentEvent;
assert(demo.members && demo.members.length === 4, 'demo has 4 members');
assert.deepStrictEqual(JSON.parse(JSON.stringify(demo.members)), ['幹事・けんた', 'さくら', 'ダイキ', 'ゆい']);
assert.deepStrictEqual(JSON.parse(JSON.stringify(demo.rules.requiredNames)), ['さくら']);
console.log('Demo event members verified.');

console.log('\n===========================================');
console.log('🎉 ALL MEMBER & PRE-RULE TESTS PASSED!');
console.log('===========================================');
