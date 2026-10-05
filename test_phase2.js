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
vm.runInContext(src + '\n;this.__t = { appState, generateIcsContent, getBestCandidate, renderShareCardDom, loadDemoData };', sandbox);
const t = sandbox.__t;

// Test 1: Load Demo Data and check getBestCandidate
console.log('Testing getBestCandidate with demo data...');
t.loadDemoData();
const demo = t.appState.currentEvent;
assert(demo, 'demo loaded');
const best = t.getBestCandidate(demo);
assert(best, 'best candidate found');
console.log('Best candidate determined:', best.text);

// Test 2: generateIcsContent for timed event
console.log('Testing generateIcsContent (Timed event)...');
const timedCandidate = {
  id: 'c_timed',
  date: '2026-10-24',
  start: '19:00',
  end: '21:30',
  text: '10月24日(土) 19:00〜'
};
const icsTimed = t.generateIcsContent(timedCandidate, demo);
assert(icsTimed, 'ics produced');
assert(icsTimed.includes('BEGIN:VCALENDAR'), 'has VCALENDAR');
assert(icsTimed.includes('BEGIN:VEVENT'), 'has VEVENT');
assert(icsTimed.includes('DTSTART:20261024T100000Z'), '19:00 JST is 10:00 UTC');
assert(icsTimed.includes('DTEND:20261024T123000Z'), '21:30 JST is 12:30 UTC');
assert(icsTimed.includes('SUMMARY:' + demo.title), 'summary matches title');
assert(icsTimed.includes('END:VCALENDAR'), 'ends VCALENDAR');
console.log('Timed .ics passed.');

// Test 3: generateIcsContent for all-day event
console.log('Testing generateIcsContent (All-day event)...');
const allDayCandidate = {
  id: 'c_allday',
  date: '2026-10-25',
  allDay: true,
  text: '10月25日(日) 終日'
};
const icsAllDay = t.generateIcsContent(allDayCandidate, demo);
assert(icsAllDay, 'all-day ics produced');
assert(icsAllDay.includes('DTSTART;VALUE=DATE:20261025'), 'all-day start date');
assert(icsAllDay.includes('DTEND;VALUE=DATE:20261026'), 'all-day end date next day');
console.log('All-day .ics passed.');

// Test 4: renderShareCardDom
console.log('Testing renderShareCardDom...');
const shareCardTarget = mk('shareCardTarget');
t.renderShareCardDom(demo);
assert(shareCardTarget.innerHTML.includes('TomoPlan'), 'includes branding');
assert(shareCardTarget.innerHTML.includes('sc-hero'), 'includes hero box');
assert(shareCardTarget.innerHTML.includes('sc-table'), 'includes candidate table');
assert(shareCardTarget.innerHTML.includes('sc-footer'), 'includes footer');
console.log('renderShareCardDom passed.');

console.log('\n===========================================');
console.log('🎉 ALL PHASE 2 TESTS PASSED!');
console.log('===========================================');
