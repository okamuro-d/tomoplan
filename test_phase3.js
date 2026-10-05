const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const configSrc = fs.readFileSync('C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/config.js', 'utf8');
const apiSrc = fs.readFileSync('C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/api.js', 'utf8');
const appSrc = fs.readFileSync('C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/app.js', 'utf8');

const els = {};
const mk = (id) => els[id] || (els[id] = {
  id, value: '', textContent: '', innerHTML: '', dataset: {}, children: [],
  classList: { add() {}, remove() {}, toggle() {} },
  addEventListener() {}, appendChild() {},
  getAttribute() { return null; },
  setAttribute() {},
  querySelector() { return mk('q'); },
  querySelectorAll() { return [mk('q1'), mk('q2'), mk('q3')]; },
  scrollIntoView() {}
});

const localStorageStore = {};
const mockLocalStorage = {
  getItem: (k) => localStorageStore[k] || null,
  setItem: (k, v) => { localStorageStore[k] = String(v); },
  removeItem: (k) => { delete localStorageStore[k]; }
};

let lastFetchCall = null;
const mockFetch = async (url, opts = {}) => {
  lastFetchCall = { url, opts };
  if (url.includes('?action=getEvent') || url.includes('&id=')) {
    return {
      ok: true,
      json: async () => ({
        success: true,
        event: {
          id: 'evt_mock123',
          title: 'モックイベント',
          candidates: [{ id: 'c1', text: '10/24(土)' }],
          responses: []
        }
      })
    };
  }
  // POST actions
  const body = opts.body ? JSON.parse(opts.body) : {};
  if (body.action === 'createEvent') {
    return {
      ok: true,
      json: async () => ({ success: true, eventId: body.id, editToken: 'tk_test_abc123' })
    };
  }
  if (body.action === 'submitResponse') {
    return {
      ok: true,
      json: async () => ({ success: true, respondentId: 'res_test123' })
    };
  }
  if (body.action === 'updateEvent') {
    return {
      ok: true,
      json: async () => ({ success: true })
    };
  }
  return { ok: true, json: async () => ({ success: true }) };
};

const sandbox = {
  console, Date, Math, JSON, setTimeout, setInterval, clearInterval,
  btoa: (str) => Buffer.from(str, 'binary').toString('base64'),
  atob: (str) => Buffer.from(str, 'base64').toString('binary'),
  fetch: mockFetch,
  window: {
    addEventListener() {},
    location: { hash: '', origin: 'https://tomoplan.local', pathname: '/' },
    scrollTo() {}
  },
  localStorage: mockLocalStorage,
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

// 1. Run config.js and api.js
vm.runInContext(configSrc, sandbox);
vm.runInContext(apiSrc, sandbox);

const TomoApi = sandbox.window.TomoApi;

// Test 1: Fallback (unconfigured) state
console.log('Testing Unconfigured Cloud State (Fallback Mode)...');
assert.strictEqual(TomoApi.isCloudEnabled(), false, 'Cloud should be disabled when GAS_API_URL is empty');
const sampleEvent = { id: 'evt_123', title: 'テスト飲み会', candidates: [] };
const fallbackUrl = TomoApi.buildShareUrl(sampleEvent);
assert(fallbackUrl.includes('#data='), 'Fallback URL must use #data= hash');
console.log('Fallback Mode verified: ' + fallbackUrl.slice(0, 40) + '...');

// Test 2: Route parsing
console.log('Testing Route Parsing...');
sandbox.window.location.hash = '#/e/evt_sample123';
let route = TomoApi.parseRoute();
assert.strictEqual(route.type, 'cloud');
assert.strictEqual(route.eventId, 'evt_sample123');

sandbox.window.location.hash = '#e/evt_sample456';
route = TomoApi.parseRoute();
assert.strictEqual(route.type, 'cloud');
assert.strictEqual(route.eventId, 'evt_sample456');

sandbox.window.location.hash = '#data=xyz123';
route = TomoApi.parseRoute();
assert.strictEqual(route.type, 'hash');
assert.strictEqual(route.raw, 'xyz123');

sandbox.window.location.hash = '';
route = TomoApi.parseRoute();
assert.strictEqual(route, null);
console.log('Route Parsing verified.');

// Test 3: Edit Token LocalStorage management
console.log('Testing Edit Token storage...');
TomoApi.saveEditToken('evt_123', 'tk_mysecret123');
assert.strictEqual(TomoApi.getEditToken('evt_123'), 'tk_mysecret123');
console.log('Edit Token storage verified.');

// Test 4: Configure Cloud and verify Short URL
console.log('Testing Configured Cloud State...');
sandbox.window.CONFIG.GAS_API_URL = 'https://script.google.com/macros/s/TEST/exec';
assert.strictEqual(TomoApi.isCloudEnabled(), true, 'Cloud should be enabled');

const cloudShareUrl = TomoApi.buildShareUrl(sampleEvent);
assert.strictEqual(cloudShareUrl, 'https://tomoplan.local/#/e/evt_123', 'Cloud URL should be short #/e/{id}');
console.log('Cloud Short URL verified:', cloudShareUrl);

// Test 5: Cloud API mock calls
(async () => {
  console.log('Testing Cloud API Calls (createEvent, getEvent, submitResponse)...');
  const createRes = await TomoApi.createEvent({ id: 'evt_test1', title: 'イベント1', candidates: [] });
  assert.strictEqual(createRes.success, true);
  assert.strictEqual(createRes.editToken, 'tk_test_abc123');

  const getRes = await TomoApi.getEvent('evt_mock123');
  assert.strictEqual(getRes.id, 'evt_mock123');
  assert.strictEqual(getRes.title, 'モックイベント');

  const submitRes = await TomoApi.submitResponse('evt_test1', {
    id: 'res_1',
    name: 'さくら',
    answers: { c1: 'ok' },
    comment: '参加します！'
  });
  assert.strictEqual(submitRes.success, true);
  console.log('Cloud API calls verified.');

  console.log('\n===========================================');
  console.log('🎉 ALL PHASE 3 API & CLOUD TESTS PASSED!');
  console.log('===========================================');
})().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
