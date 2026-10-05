/**
 * TomoPlan - 友達とサクッと決まる日程調整 Web App
 * Standalone Client-side Architecture with URL State & LocalStorage
 */

// =============================================================================
// State & Storage
// =============================================================================

const STORAGE_KEYS = {
  CURRENT_EVENT: 'tomoplan_current_event',
  HISTORY: 'tomoplan_events_history',
  SAVED_NAME: 'tomoplan_saved_username',
  THEME: 'tomoplan_theme'
};

let appState = {
  currentEvent: null,
  newCandidates: [], // 新規作成時の候補日リスト [{ id, text, date, time }]
  newMembers: [], // 新規作成時の参加予定メンバー ['さくら', 'けんた', ...]
  activeRespondentAnswers: {}, // { candidateId: 'ok' | 'triangle' | 'ng' }
};

// =============================================================================
// Initialization
// =============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  setupEventListeners();
  initDatePickerDefaults();

  // URLハッシュからイベントデータをロード（共有URLで開かれた場合）
  const loadedFromUrl = await loadEventFromUrl();
  if (!loadedFromUrl) {
    // URLになければLocalStorageの前回表示イベントを確認
    const savedEvent = loadEventFromStorage();
    if (savedEvent) {
      showEventDetail(savedEvent);
    } else {
      showCreateView();
    }
  }

  // 保存されたユーザー名を復元
  const savedName = localStorage.getItem(STORAGE_KEYS.SAVED_NAME);
  if (savedName) {
    const nameInput = document.getElementById('userName');
    if (nameInput) nameInput.value = savedName;
  }
});

// =============================================================================
// Theme Management (Light / Dark)
// =============================================================================

function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME) || 'light';
  document.body.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.body.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', newTheme);
  localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (icon) {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

// =============================================================================
// Event Listeners Setup
// =============================================================================

function setupEventListeners() {
  // ナビゲーション
  document.getElementById('brandLogo').addEventListener('click', () => {
    if (appState.currentEvent) {
      showEventDetail(appState.currentEvent);
    } else {
      showCreateView();
    }
  });

  document.getElementById('btnNewEventNav').addEventListener('click', () => {
    showCreateView();
  });

  document.getElementById('btnThemeToggle').addEventListener('click', toggleTheme);
  document.getElementById('btnHistoryModal').addEventListener('click', openHistoryModal);
  document.getElementById('btnCloseHistoryModal').addEventListener('click', closeHistoryModal);

  // イベント作成関連
  document.getElementById('btnAddCandidate').addEventListener('click', handleAddCandidateFromPicker);
  document.getElementById('btnClearAllCandidates').addEventListener('click', clearAllCandidates);
  document.getElementById('btnApplyBulkDates').addEventListener('click', handleApplyBulkDates);
  document.getElementById('btnCreateEvent').addEventListener('click', handleCreateEvent);
  document.getElementById('pickerTimeType').addEventListener('change', (e) => {
    const customCol = document.getElementById('customTimeCol');
    if (e.target.value === 'custom') {
      customCol.classList.remove('hidden');
      document.getElementById('pickerCustomTime').focus();
    } else {
      customCol.classList.add('hidden');
    }
  });

  // クイック追加プリセット（今月・来月・再来月の土日）
  document.getElementById('btnAddThisMonthWeekend').addEventListener('click', () => addMonthWeekends(0));
  document.getElementById('btnAddNextMonthWeekend').addEventListener('click', () => addMonthWeekends(1));
  document.getElementById('btnAddMonthAfterNextWeekend').addEventListener('click', () => addMonthWeekends(2));
  document.getElementById('btnLoadDemoEvent').addEventListener('click', loadDemoData);
  updateQuickAddLabels();

  // 参加予定メンバー登録（作成画面）
  document.getElementById('btnAddMember').addEventListener('click', handleAddMemberFromInput);
  document.getElementById('memberInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddMemberFromInput();
    }
  });
  renderMembersTags();
  renderRequiredMembersPicker();

  // イベントの前提ルール（作成画面）
  document.getElementById('ruleExcludeNg').addEventListener('change', (e) => {
    appState.newRules.excludeIfAnyNg = e.target.checked;
    updateRulesBadge();
  });

  // 回答者名の変更 → 本人の回答を除いて「除外日程」を再判定
  document.getElementById('userName').addEventListener('input', syncResponseFormToName);

  // 結果フィルタ（イベント委譲）
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-filter-action]');
    if (el && !el.disabled) handleFilterAction(el.getAttribute('data-filter-action'), el);
  });

  // イベント詳細画面アクション
  document.getElementById('btnCopyShareUrl').addEventListener('click', copyShareUrl);
  document.getElementById('btnCopyLineText').addEventListener('click', copyLineMessage);
  document.getElementById('btnExportImage').addEventListener('click', exportSummaryImage);
  document.getElementById('btnShareModal').addEventListener('click', openShareModal);
  document.getElementById('btnCloseShareModal').addEventListener('click', closeShareModal);
  document.getElementById('btnModalCopyUrl').addEventListener('click', copyShareUrl);
  document.getElementById('btnModalCopyLineText').addEventListener('click', copyLineMessage);
  document.getElementById('btnModalExportImage').addEventListener('click', exportSummaryImage);
  document.getElementById('btnModalIcs').addEventListener('click', handleExportBestIcs);
  document.getElementById('btnModalGCal').addEventListener('click', addToGoogleCalendar);
  document.getElementById('btnAddToIcs').addEventListener('click', handleExportBestIcs);
  document.getElementById('btnAddToCalendar').addEventListener('click', addToGoogleCalendar);

  // 画像プレビューモーダル
  document.getElementById('btnCloseImagePreview').addEventListener('click', closeImagePreviewModal);
  document.getElementById('btnPreviewClose').addEventListener('click', closeImagePreviewModal);
  document.getElementById('btnPreviewDownload').addEventListener('click', handleDownloadPreviewImage);
  document.getElementById('btnPreviewShare').addEventListener('click', handleSharePreviewImage);

  // イベント編集モーダル
  document.getElementById('btnEditEventMeta').addEventListener('click', openEditModal);
  document.getElementById('btnCloseEditModal').addEventListener('click', closeEditModal);
  document.getElementById('btnCancelEdit').addEventListener('click', closeEditModal);
  document.getElementById('btnSaveEdit').addEventListener('click', handleSaveEditEvent);

  // 回答フォーム
  document.getElementById('btnBulkOk').addEventListener('click', () => setAllAnswers('ok'));
  document.getElementById('btnBulkTriangle').addEventListener('click', () => setAllAnswers('triangle'));
  document.getElementById('btnBulkNg').addEventListener('click', () => setAllAnswers('ng'));
  document.getElementById('btnSubmitResponse').addEventListener('click', handleSubmitResponse);

  // モーダル背景クリックで閉じる
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.add('hidden');
    }
  });
}

// =============================================================================
// Candidate Date Picker Logic
// =============================================================================

function initDatePickerDefaults() {
  const pickerDate = document.getElementById('pickerDate');
  if (pickerDate) {
    const today = new Date();
    pickerDate.value = formatDateYMD(today);
    pickerDate.min = formatDateYMD(today);
  }
}

function formatDateYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatJapaneseDate(dateObj, timeStr = '') {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();
  const dayName = days[dateObj.getDay()];
  const timeSuffix = timeStr ? ` ${timeStr}` : '';
  return `${m}月${d}日(${dayName})${timeSuffix}`;
}

// -----------------------------------------------------------------------------
// 候補日の構造化データ
//   { id, date:'YYYY-MM-DD', timeLabel, start:'HH:MM', end:'HH:MM', allDay, text }
//   text は表示用ラベル。date/start/end は .ics やカレンダー連携で利用する。
// -----------------------------------------------------------------------------

const TIME_PRESETS = {
  '終日': { allDay: true },
  '昼 (12:00〜)': { start: '12:00', end: '14:00' },
  '夜 (18:00〜)': { start: '18:00', end: '20:30' },
  '夜 (19:00〜)': { start: '19:00', end: '21:30' },
  '午前': { start: '09:00', end: '12:00' },
  '午後': { start: '13:00', end: '17:00' }
};

function pad2(n) {
  return String(n).padStart(2, '0');
}

function addMinutesHHMM(hhmm, minutes) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = Math.min(h * 60 + m + minutes, 23 * 60 + 59);
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

// "19:00〜21:00" や "19:00〜" から開始・終了時刻を取り出す（終了未指定は+2時間）
function parseTimeRange(str) {
  if (!str) return null;
  const range = str.match(/(\d{1,2}):(\d{2})\s*[〜~～\-–ー]\s*(\d{1,2}):(\d{2})/);
  if (range) {
    return { start: `${pad2(range[1])}:${range[2]}`, end: `${pad2(range[3])}:${range[4]}` };
  }
  const single = str.match(/(\d{1,2}):(\d{2})/);
  if (single) {
    const start = `${pad2(single[1])}:${single[2]}`;
    return { start, end: addMinutesHHMM(start, 120) };
  }
  return null;
}

function getTimeInfo(timeLabel) {
  if (TIME_PRESETS[timeLabel]) return TIME_PRESETS[timeLabel];
  return parseTimeRange(timeLabel) || { allDay: true };
}

function newCandidateId() {
  return 'c_' + Math.random().toString(36).substring(2, 9);
}

function buildCandidate(dateStr, timeLabel) {
  const dateObj = new Date(dateStr + 'T00:00:00');
  const info = getTimeInfo(timeLabel);
  return {
    id: newCandidateId(),
    date: dateStr,
    timeLabel: timeLabel,
    start: info.start || '',
    end: info.end || '',
    allDay: !info.start,
    text: formatJapaneseDate(dateObj, timeLabel)
  };
}

// 月日だけが分かる場合、今日より前なら翌年として扱う
function inferDateFromMonthDay(month, day) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let year = today.getFullYear();
  if (new Date(year, month - 1, day) < today) year++;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function getPickerTimeLabel() {
  const type = document.getElementById('pickerTimeType').value;
  if (type === 'custom') {
    return document.getElementById('pickerCustomTime').value.trim() || '時間指定なし';
  }
  return type;
}

function handleAddCandidateFromPicker() {
  const pickerDate = document.getElementById('pickerDate');

  if (!pickerDate.value) {
    showToast('日付を選択してください', 'error');
    return;
  }

  const selectedDate = new Date(pickerDate.value + 'T00:00:00');
  addCandidate(buildCandidate(pickerDate.value, getPickerTimeLabel()));

  // カレンダーの日付を1日進める（連続追加の利便性）
  selectedDate.setDate(selectedDate.getDate() + 1);
  pickerDate.value = formatDateYMD(selectedDate);
}

// 重複時は false。日付順に並べ替えは呼び出し側で行う
function pushCandidate(candidate) {
  if (appState.newCandidates.some(c => c.text === candidate.text)) return false;
  appState.newCandidates.push(candidate);
  return true;
}

function sortNewCandidates() {
  appState.newCandidates.sort((a, b) => {
    const keyA = (a.date || '9999-99-99') + (a.start || '');
    const keyB = (b.date || '9999-99-99') + (b.start || '');
    return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
  });
}

function addCandidate(candidate) {
  if (!pushCandidate(candidate)) {
    showToast('この候補日は既に追加されています', 'error');
    return false;
  }
  sortNewCandidates();
  renderCandidateTags();
  showToast(`「${candidate.text}」を追加しました`, 'success');
  return true;
}

function removeCandidate(id) {
  appState.newCandidates = appState.newCandidates.filter(c => c.id !== id);
  renderCandidateTags();
}

function clearAllCandidates() {
  appState.newCandidates = [];
  renderCandidateTags();
}

function renderCandidateTags() {
  const container = document.getElementById('candidateList');
  const countEl = document.getElementById('candidateCount');
  const clearBtn = document.getElementById('btnClearAllCandidates');

  countEl.textContent = appState.newCandidates.length;

  if (appState.newCandidates.length === 0) {
    container.innerHTML = `<p class="empty-hint" id="noCandidateHint">日付を選んで「候補に追加」を押してください。</p>`;
    clearBtn.classList.add('hidden');
    return;
  }

  clearBtn.classList.remove('hidden');
  container.innerHTML = '';

  appState.newCandidates.forEach((c) => {
    const tag = document.createElement('div');
    tag.className = 'candidate-tag';
    tag.innerHTML = `
      <span>${escapeHtml(c.text)}</span>
      <button type="button" class="tag-remove-btn" title="削除" aria-label="削除">&times;</button>
    `;
    tag.querySelector('.tag-remove-btn').addEventListener('click', () => removeCandidate(c.id));
    container.appendChild(tag);
  });
}

function handleApplyBulkDates() {
  const textarea = document.getElementById('bulkDateText');
  const lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length === 0) {
    showToast('追加する候補日を入力してください', 'error');
    return;
  }

  let addedCount = 0;
  lines.forEach(line => {
    // "10/24(土) 18:00〜" や "10月24日 夜" から日付・時刻を読み取れれば構造化する
    const md = line.match(/(\d{1,2})[\/月](\d{1,2})/);
    const time = parseTimeRange(line);
    const candidate = {
      id: newCandidateId(),
      text: line,
      timeLabel: line,
      date: md ? inferDateFromMonthDay(Number(md[1]), Number(md[2])) : '',
      start: time ? time.start : '',
      end: time ? time.end : '',
      allDay: !time
    };
    if (pushCandidate(candidate)) addedCount++;
  });

  textarea.value = '';
  sortNewCandidates();
  renderCandidateTags();
  showToast(`${addedCount}件の候補日を追加しました`, 'success');
}

// クイック追加ヘルパー: 指定月（0=今月 / 1=来月 / 2=再来月）の土日を一括追加
const QUICK_ADD_BUTTONS = [
  { id: 'btnAddThisMonthWeekend', name: '今月土日', offset: 0 },
  { id: 'btnAddNextMonthWeekend', name: '来月土日', offset: 1 },
  { id: 'btnAddMonthAfterNextWeekend', name: '再来月土日', offset: 2 }
];

function updateQuickAddLabels() {
  const now = new Date();
  QUICK_ADD_BUTTONS.forEach(({ id, name, offset }) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const month = new Date(now.getFullYear(), now.getMonth() + offset, 1).getMonth() + 1;
    btn.textContent = `${name} (${month}月)`;
  });
}

function addMonthWeekends(monthOffset) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // 月跨ぎのズレを避けるため、必ず1日を基準に月を決める
  const firstDay = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const targetMonth = firstDay.getMonth();
  const timeLabel = getPickerTimeLabel();

  let added = 0;
  let skipped = 0;
  for (let d = new Date(firstDay); d.getMonth() === targetMonth; d.setDate(d.getDate() + 1)) {
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) continue;
    if (d < today) continue; // 過去日は追加しない
    if (pushCandidate(buildCandidate(formatDateYMD(d), timeLabel))) added++;
    else skipped++;
  }

  sortNewCandidates();
  renderCandidateTags();

  const monthName = `${targetMonth + 1}月`;
  if (added === 0 && skipped === 0) {
    showToast(`${monthName}に追加できる土日がありません`, 'error');
  } else if (added === 0) {
    showToast(`${monthName}の土日はすべて追加済みです`, 'error');
  } else {
    const skipNote = skipped > 0 ? `（重複${skipped}件はスキップ）` : '';
    showToast(`${monthName}の土日を${added}件追加しました${skipNote} ／ 時間帯: ${timeLabel}`, 'success');
  }
}

// =============================================================================
// Event Rules（イベントの前提ルール）
//   event.rules = { excludeIfAnyNg: boolean, requiredNames: string[] }
//   rules が無い旧イベントは「ルールなし」として扱う（後方互換）
// =============================================================================

const SCHEMA_VERSION = 2;

function defaultRules() {
  return { excludeIfAnyNg: false, requiredNames: [] };
}

appState.newRules = defaultRules();

function normalizeRules(rules) {
  const base = defaultRules();
  if (!rules) return base;
  base.excludeIfAnyNg = !!rules.excludeIfAnyNg;
  if (Array.isArray(rules.requiredNames)) {
    base.requiredNames = rules.requiredNames.map(s => String(s).trim()).filter(Boolean);
  }
  return base;
}

function hasRules(rules) {
  const r = normalizeRules(rules);
  return r.excludeIfAnyNg || r.requiredNames.length > 0;
}

// 名前の表記ゆれ（全角半角・大文字小文字・空白）を吸収して照合する
function normalizeName(name) {
  return String(name || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

// 候補が「除外済み」か判定し、理由を返す（除外でなければ null）
//   selfName と同名の回答は無視する（本人の再回答時に自分の✕を取り消せるように）
//   ✕のみが除外条件。△・未回答は除外しない。
function getDeadReason(candidate, event, selfName = '') {
  if (!event || !event.rules) return null;
  const rules = normalizeRules(event.rules);
  if (!hasRules(rules)) return null;

  const self = normalizeName(selfName);
  const others = (event.responses || []).filter(r => !self || normalizeName(r.name) !== self);
  const required = rules.requiredNames.map(normalizeName);

  if (others.some(r => required.includes(normalizeName(r.name)) && r.answers[candidate.id] === 'ng')) {
    return 'required';
  }
  if (rules.excludeIfAnyNg && others.some(r => r.answers[candidate.id] === 'ng')) {
    return 'anyNg';
  }
  return null;
}

function describeDeadReason(reason) {
  if (reason === 'required') return '必須参加者が✕';
  if (reason === 'anyNg') return '✕あり';
  return '';
}

function updateRulesBadge() {
  const badge = document.getElementById('rulesBadge');
  if (badge) badge.classList.toggle('hidden', !hasRules(appState.newRules));
}

// -----------------------------------------------------------------------------
// 参加予定メンバー登録 & 必須参加者ピッカー（作成画面）
// -----------------------------------------------------------------------------

function handleAddMemberFromInput() {
  const input = document.getElementById('memberInput');
  const val = input.value.trim();
  if (!val) return;
  addMembersFromString(val);
  input.value = '';
}

function addMembersFromString(rawStr) {
  // カンマ、読点、改行、半角/全角空白などで分割
  const names = rawStr
    .split(/[,、\n\r\t\s\u3000]+/)
    .map(s => s.trim())
    .filter(Boolean);

  if (names.length === 0) return;

  let addedCount = 0;
  names.forEach(name => {
    const exists = appState.newMembers.some(m => normalizeName(m) === normalizeName(name));
    if (!exists) {
      appState.newMembers.push(name);
      addedCount++;
    }
  });

  if (addedCount > 0) {
    renderMembersTags();
    renderRequiredMembersPicker();
    showToast(`${addedCount}名のメンバーを追加しました`, 'success');
  } else {
    showToast('すでに追加されています', 'error');
  }
}

function removeMember(name) {
  appState.newMembers = appState.newMembers.filter(m => normalizeName(m) !== normalizeName(name));
  // 必須参加者からも自動削除
  appState.newRules.requiredNames = appState.newRules.requiredNames.filter(n => normalizeName(n) !== normalizeName(name));
  renderMembersTags();
  renderRequiredMembersPicker();
  updateRulesBadge();
}

function renderMembersTags() {
  const container = document.getElementById('membersList');
  if (!container) return;

  container.innerHTML = '';
  if (appState.newMembers.length === 0) {
    container.innerHTML = '<p class="empty-hint" id="noMembersHint">メンバーを登録すると、回答時の名前選択や必須指定が簡単になります。</p>';
    return;
  }

  appState.newMembers.forEach(name => {
    const isRequired = appState.newRules.requiredNames.some(n => normalizeName(n) === normalizeName(name));
    const tag = document.createElement('div');
    tag.className = 'candidate-tag';
    tag.innerHTML = `
      <span>👤 ${escapeHtml(name)}${isRequired ? ' <strong style="color:var(--color-ng); font-size:0.75rem;">(必須)</strong>' : ''}</span>
      <button type="button" class="tag-remove-btn" title="削除" aria-label="${escapeHtml(name)}を削除">&times;</button>
    `;
    tag.querySelector('.tag-remove-btn').addEventListener('click', () => removeMember(name));
    container.appendChild(tag);
  });
}

function renderRequiredMembersPicker() {
  const container = document.getElementById('requiredMembersPicker');
  if (!container) return;

  container.innerHTML = '';
  if (appState.newMembers.length === 0) {
    container.innerHTML = '<p class="empty-hint">上の「参加予定メンバー」を登録すると、ここから必須参加者をチェック選択できます。</p>';
    return;
  }

  appState.newMembers.forEach(name => {
    const isChecked = appState.newRules.requiredNames.some(n => normalizeName(n) === normalizeName(name));
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `req-member-chip ${isChecked ? 'active' : ''}`;
    btn.innerHTML = `
      <span>${isChecked ? '★' : '☆'}</span>
      <span>${escapeHtml(name)}</span>
      <span style="font-size:0.72rem; opacity:0.85;">${isChecked ? '必須' : '任意'}</span>
    `;
    btn.addEventListener('click', () => {
      toggleRequiredMember(name);
    });
    container.appendChild(btn);
  });
}

function toggleRequiredMember(name) {
  const norm = normalizeName(name);
  const exists = appState.newRules.requiredNames.some(n => normalizeName(n) === norm);
  if (exists) {
    appState.newRules.requiredNames = appState.newRules.requiredNames.filter(n => normalizeName(n) !== norm);
  } else {
    appState.newRules.requiredNames.push(name);
  }
  renderMembersTags();
  renderRequiredMembersPicker();
  updateRulesBadge();
}

// =============================================================================
// Event Creation & View Switching
// =============================================================================

async function handleCreateEvent() {
  const titleInput = document.getElementById('eventTitle');
  const descInput = document.getElementById('eventDescription');

  const title = titleInput.value.trim();
  const desc = descInput.value.trim();

  if (!title) {
    showToast('イベント名を入力してください', 'error');
    titleInput.focus();
    return;
  }

  if (appState.newCandidates.length === 0) {
    showToast('候補日程を1つ以上追加してください', 'error');
    return;
  }

  // 入力途中のメンバー名があれば確定
  const memberInput = document.getElementById('memberInput');
  if (memberInput && memberInput.value.trim()) {
    addMembersFromString(memberInput.value.trim());
    memberInput.value = '';
  }

  const createBtn = document.getElementById('btnCreateEvent');
  if (createBtn) createBtn.disabled = true;

  const newEvent = {
    schemaVersion: SCHEMA_VERSION,
    id: (typeof TomoApi !== 'undefined' && TomoApi.generateShortId) ? TomoApi.generateShortId(6) : (Date.now().toString(36).slice(-3) + Math.random().toString(36).substring(2, 5)),
    title: title,
    description: desc,
    createdAt: new Date().toISOString(),
    members: [...appState.newMembers],
    candidates: [...appState.newCandidates],
    rules: normalizeRules(appState.newRules),
    responses: []
  };

  try {
    if (typeof TomoApi !== 'undefined' && TomoApi.isCloudEnabled()) {
      showToast('☁️ クラウド（スプレッドシート）に保存中...', 'info');
      const res = await TomoApi.createEvent(newEvent);
      if (res && res.editToken) {
        TomoApi.saveEditToken(newEvent.id, res.editToken);
      }
    }
    saveEventToStorage(newEvent);
    showEventDetail(newEvent);
    openShareModal();
    showToast('🎉 イベントを作成しました！共有リンクをコピーして友達に送れます', 'success');
  } catch (err) {
    console.error('Create event error', err);
    saveEventToStorage(newEvent);
    showEventDetail(newEvent);
    openShareModal();
    showToast('⚠️ クラウド同期でエラーが発生したため、端末内に保存しました', 'error');
  } finally {
    if (createBtn) createBtn.disabled = false;
  }
}

function showCreateView() {
  document.getElementById('viewCreate').classList.add('active');
  document.getElementById('viewDetail').classList.remove('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showEventDetail(eventData) {
  // 前提ルールを正規化（ルール無しの旧イベントもそのまま開ける）
  eventData.rules = normalizeRules(eventData.rules);
  eventData.schemaVersion = eventData.schemaVersion || 1;

  // 別イベントに切り替わるときはフィルタ条件をリセット
  if (!appState.currentEvent || appState.currentEvent.id !== eventData.id) {
    appState.filters = defaultFilters();
    appState.syncedRespondentId = null;
  }
  appState.currentEvent = eventData;
  document.getElementById('viewCreate').classList.remove('active');
  document.getElementById('viewDetail').classList.add('active');

  renderEventBanner();
  renderMatrixTable();
  renderResponseForm();
  renderCommentsTimeline();
  updateBestDate();
  updateUrlHash();

  startCloudSyncTimer();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================================================
// Detail View Renderers
// =============================================================================

function renderEventBanner() {
  const event = appState.currentEvent;
  if (!event) return;

  document.getElementById('eventViewTitle').textContent = event.title;
  const descEl = document.getElementById('eventViewDesc');
  if (event.description) {
    descEl.textContent = event.description;
    descEl.classList.remove('hidden');
  } else {
    descEl.classList.add('hidden');
  }

  const createdDate = new Date(event.createdAt);
  document.getElementById('eventCreatedDate').textContent = `作成: ${createdDate.toLocaleDateString('ja-JP')} ${createdDate.getHours()}:${String(createdDate.getMinutes()).padStart(2, '0')}`;
  document.getElementById('respondentCount').textContent = event.responses ? event.responses.length : 0;

  const syncBadge = document.getElementById('syncStatusBadge');
  if (syncBadge) {
    if (typeof TomoApi !== 'undefined' && TomoApi.isCloudEnabled()) {
      syncBadge.textContent = '☁️ クラウド同期中 (GAS)';
      syncBadge.className = 'badge badge-primary';
      syncBadge.title = 'Googleスプレッドシートとリアルタイム同期中';
    } else {
      syncBadge.textContent = '💾 ローカル動作';
      syncBadge.className = 'badge badge-secondary';
      syncBadge.title = 'LocalStorage & ハッシュURLで動作中 (gas/README.mdで無料クラウド化可能)';
    }
  }
}

// -----------------------------------------------------------------------------
// 結果フィルタ（すべてAND条件）
//   excludeNg : 誰かが✕の日を除外
//   minOk     : ◯がN人以上（countTri が true なら△も参加可能として数える）
//   people    : 選択した人が全員◯の日だけ残す（例: 主役は必ず◯）
// -----------------------------------------------------------------------------

function defaultFilters() {
  return { excludeNg: false, minOk: 0, countTri: false, people: [], hideDead: false };
}

appState.filters = defaultFilters();

function isFilterActive() {
  const f = appState.filters;
  return f.excludeNg || f.minOk > 0 || f.people.length > 0 || f.hideDead;
}

function countAnswers(candidateId, responses) {
  let ok = 0, tri = 0, ng = 0;
  responses.forEach(r => {
    const val = r.answers[candidateId];
    if (val === 'ok') ok++;
    else if (val === 'triangle') tri++;
    else if (val === 'ng') ng++;
  });
  return { ok, tri, ng };
}

function getFilteredCandidates() {
  const event = appState.currentEvent;
  if (!event) return [];
  const candidates = event.candidates || [];
  const responses = event.responses || [];
  const f = appState.filters;
  if (!isFilterActive()) return candidates;

  return candidates.filter(c => {
    const { ok, tri, ng } = countAnswers(c.id, responses);
    if (f.hideDead && getDeadReason(c, event)) return false;
    if (f.excludeNg && ng > 0) return false;
    if (f.minOk > 0 && (ok + (f.countTri ? tri : 0)) < f.minOk) return false;
    return f.people.every(pid => {
      const r = responses.find(res => res.id === pid);
      return !r || r.answers[c.id] === 'ok';
    });
  });
}

function handleFilterAction(action, el) {
  const event = appState.currentEvent;
  if (!event) return;
  const f = appState.filters;
  const respondentTotal = (event.responses || []).length;

  switch (action) {
    case 'toggleNg':
      f.excludeNg = !f.excludeNg;
      break;
    case 'toggleHideDead':
      f.hideDead = !f.hideDead;
      break;
    case 'minOkInc':
      f.minOk = Math.min(f.minOk + 1, respondentTotal);
      break;
    case 'minOkDec':
      f.minOk = Math.max(f.minOk - 1, 0);
      if (f.minOk === 0) f.countTri = false;
      break;
    case 'toggleTri':
      f.countTri = !f.countTri;
      break;
    case 'togglePerson': {
      const pid = el.getAttribute('data-person-id');
      f.people = f.people.includes(pid) ? f.people.filter(p => p !== pid) : [...f.people, pid];
      break;
    }
    case 'reset':
      appState.filters = defaultFilters();
      break;
    default:
      return;
  }

  renderMatrixTable();
  updateBestDate();
}

function renderFilterBar() {
  const bar = document.getElementById('filterBar');
  if (!bar) return;
  const event = appState.currentEvent;
  const responses = event ? (event.responses || []) : [];

  // 回答が無い間はフィルタ不要
  if (!event || responses.length === 0) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }
  bar.classList.remove('hidden');

  const f = appState.filters;
  if (f.minOk > responses.length) f.minOk = responses.length;
  f.people = f.people.filter(id => responses.some(r => r.id === id));

  const total = event.candidates.length;
  const shown = getFilteredCandidates().length;

  const personChips = responses.map(r => `
    <button type="button" class="filter-chip ${f.people.includes(r.id) ? 'active' : ''}"
      data-filter-action="togglePerson" data-person-id="${escapeHtml(r.id)}"
      aria-pressed="${f.people.includes(r.id)}">${escapeHtml(r.name)}</button>
  `).join('');

  bar.innerHTML = `
    <div class="filter-row">
      <button type="button" class="filter-chip ${f.excludeNg ? 'active' : ''}"
        data-filter-action="toggleNg" aria-pressed="${f.excludeNg}">🚫 ✕がある日を除外</button>
      ${hasRules(event.rules) ? `<button type="button" class="filter-chip ${f.hideDead ? 'active' : ''}" data-filter-action="toggleHideDead" aria-pressed="${f.hideDead}">📏 ルールで除外された日を隠す</button>` : ''}
      <div class="filter-stepper" role="group" aria-label="参加可能な人数">
        <button type="button" class="stepper-btn" data-filter-action="minOkDec" aria-label="人数を減らす" ${f.minOk <= 0 ? 'disabled' : ''}>−</button>
        <span class="stepper-value">${f.minOk > 0 ? `${f.minOk}人以上` : '人数指定なし'}</span>
        <button type="button" class="stepper-btn" data-filter-action="minOkInc" aria-label="人数を増やす" ${f.minOk >= responses.length ? 'disabled' : ''}>＋</button>
        <span class="stepper-label">参加可能</span>
      </div>
      ${f.minOk > 0 ? `<button type="button" class="filter-chip ${f.countTri ? 'active' : ''}" data-filter-action="toggleTri" aria-pressed="${f.countTri}">△も参加に含める</button>` : ''}
    </div>
    <div class="filter-row">
      <span class="filter-label">👤 この人が◯の日だけ:</span>
      ${personChips}
    </div>
    <div class="filter-summary">
      <span>${total}件中 <strong>${shown}</strong>件を表示</span>
      ${isFilterActive() ? '<button type="button" class="btn-text-danger" data-filter-action="reset">条件をリセット</button>' : ''}
    </div>
  `;
}

function renderMatrixTable() {
  const event = appState.currentEvent;
  const container = document.getElementById('matrixTableContainer');
  if (!event || !container) return;

  renderFilterBar();

  const allCandidates = event.candidates || [];
  const candidates = getFilteredCandidates();
  const responses = event.responses || [];

  if (allCandidates.length === 0) {
    container.innerHTML = '<p class="empty-hint" style="padding:1.5rem;">候補日程がありません。</p>';
    return;
  }

  if (candidates.length === 0) {
    container.innerHTML = `
      <div class="filter-empty">
        <p>条件に合う日程がありません。</p>
        <button type="button" class="btn btn-secondary btn-sm" data-filter-action="reset">条件をリセット</button>
      </div>`;
    return;
  }

  // スコア計算
  const candidateScores = candidates.map(c => {
    let ok = 0;
    let tri = 0;
    let ng = 0;
    responses.forEach(r => {
      const val = r.answers[c.id];
      if (val === 'ok') ok++;
      else if (val === 'triangle') tri++;
      else if (val === 'ng') ng++;
    });
    const score = (ok * 2) + (tri * 1);
    return { id: c.id, ok, tri, ng, score, total: responses.length };
  });

  // ルールで除外された日程は「ベスト」の対象外
  const deadMap = {};
  candidates.forEach(c => { deadMap[c.id] = getDeadReason(c, event); });
  const maxScore = Math.max(...candidateScores.filter(s => !deadMap[s.id]).map(s => s.score), 0);

  let html = `
    <table class="matrix-table">
      <thead>
        <tr>
          <th class="col-date-header">候補日程</th>
          <th class="col-stat-header">出欠状況</th>
  `;

  // 参加者ヘッダー列
  responses.forEach(r => {
    html += `<th>${escapeHtml(r.name)}</th>`;
  });

  if (responses.length === 0) {
    html += `<th>回答者</th>`;
  }

  html += `
        </tr>
      </thead>
      <tbody>
  `;

  candidates.forEach(c => {
    const stat = candidateScores.find(s => s.id === c.id) || { ok: 0, tri: 0, ng: 0, score: 0 };
    const isBest = !deadMap[c.id] && responses.length > 0 && stat.score > 0 && stat.score === maxScore;

    const totalVotes = stat.ok + stat.tri + stat.ng;
    const okPct = totalVotes > 0 ? (stat.ok / totalVotes) * 100 : 0;
    const triPct = totalVotes > 0 ? (stat.tri / totalVotes) * 100 : 0;
    const ngPct = totalVotes > 0 ? (stat.ng / totalVotes) * 100 : 0;

    html += `
      <tr class="${isBest ? 'highlight-best-row' : ''} ${deadMap[c.id] ? 'row-dead' : ''}">
        <td class="col-date">
          ${isBest ? '👑 ' : ''}${escapeHtml(c.text)}
          ${deadMap[c.id] ? `<span class="dead-badge">🚫 ${describeDeadReason(deadMap[c.id])}</span>` : ''}
        </td>
        <td class="col-stat">
          <div style="font-size:0.8rem; font-weight:700;">
            <span style="color:var(--color-ok);">◯ ${stat.ok}</span>
            <span style="color:var(--color-triangle); margin-left:4px;">△ ${stat.tri}</span>
            <span style="color:var(--color-ng); margin-left:4px;">✕ ${stat.ng}</span>
          </div>
          <div class="ratio-bar-wrap" title="◯: ${stat.ok}, △: ${stat.tri}, ✕: ${stat.ng}">
            <div class="ratio-bar-ok" style="width: ${okPct}%"></div>
            <div class="ratio-bar-tri" style="width: ${triPct}%"></div>
            <div class="ratio-bar-ng" style="width: ${ngPct}%"></div>
          </div>
        </td>
    `;

    if (responses.length === 0) {
      html += `<td style="color:var(--text-light); font-size:0.8rem;">まだ回答がありません</td>`;
    } else {
      responses.forEach(r => {
        const val = r.answers[c.id];
        let markHtml = '-';
        if (val === 'ok') markHtml = '<span class="badge-circle mark-ok">◯</span>';
        else if (val === 'triangle') markHtml = '<span class="badge-circle mark-triangle">△</span>';
        else if (val === 'ng') markHtml = '<span class="badge-circle mark-ng">✕</span>';

        html += `<td>${markHtml}</td>`;
      });
    }

    html += `</tr>`;
  });

  html += `
      </tbody>
    </table>
  `;

  container.innerHTML = html;
}

function renderResponseForm() {
  const event = appState.currentEvent;
  const container = document.getElementById('datesAnswerList');
  if (!event || !container) return;

  container.innerHTML = '';
  appState.activeRespondentAnswers = {};

  // 登録メンバー選択エリアの描画
  renderMemberSelectSection();

  // 除外日程の案内バナー（初回のみ作成）
  if (!document.getElementById('deadNotice')) {
    const notice = document.createElement('div');
    notice.id = 'deadNotice';
    notice.className = 'dead-notice hidden';
    container.parentNode.insertBefore(notice, container);
  }

  event.candidates.forEach(c => {
    const row = document.createElement('div');
    row.className = 'date-vote-item';
    row.setAttribute('data-candidate-id', c.id);
    row.innerHTML = `
      <div class="vote-date-text">
        ${escapeHtml(c.text)}
        <span class="dead-badge hidden"></span>
      </div>
      <div class="vote-button-group" data-candidate-id="${c.id}">
        <button type="button" class="vote-radio-btn" data-val="ok" title="参加可能">◯</button>
        <button type="button" class="vote-radio-btn" data-val="triangle" title="未定・条件付き">△</button>
        <button type="button" class="vote-radio-btn" data-val="ng" title="不参加">✕</button>
      </div>
    `;

    // ボタングループのクリックイベント（除外日程は disabled なので発火しない）
    row.querySelectorAll('.vote-radio-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        appState.activeRespondentAnswers[c.id] = btn.getAttribute('data-val');
        setRowSelection(c.id, btn.getAttribute('data-val'));
      });
    });

    container.appendChild(row);
  });

  // 前回の同期状態を捨て、現在の名前で除外判定・プリフィルを行う
  appState.syncedRespondentId = null;
  syncResponseFormToName();
}

function renderMemberSelectSection() {
  const event = appState.currentEvent;
  const section = document.getElementById('memberSelectSection');
  const chipsContainer = document.getElementById('memberSelectChips');
  const customWrap = document.getElementById('customNameWrap');
  const userInput = document.getElementById('userName');

  if (!section || !chipsContainer) return;

  const members = event && Array.isArray(event.members) ? event.members : [];
  if (members.length === 0) {
    section.classList.add('hidden');
    customWrap.classList.remove('hidden');
    return;
  }

  section.classList.remove('hidden');
  chipsContainer.innerHTML = '';

  const currentVal = userInput.value.trim();
  const responses = event.responses || [];

  members.forEach(m => {
    const hasAnswered = responses.some(r => normalizeName(r.name) === normalizeName(m));
    const isSelected = currentVal && normalizeName(currentVal) === normalizeName(m);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `member-select-btn ${isSelected ? 'selected' : ''}`;
    btn.innerHTML = `
      <span>👤 ${escapeHtml(m)}</span>
      ${hasAnswered ? '<span class="member-status-badge">回答済 ✅</span>' : ''}
    `;

    btn.addEventListener('click', () => {
      userInput.value = m;
      customWrap.classList.add('hidden'); // メンバー選択時は自由入力欄を隠してすっきり
      renderMemberSelectSection();
      syncResponseFormToName();
      showToast(`「${m}」さんとして出欠を入力します`, 'success');
    });

    chipsContainer.appendChild(btn);
  });

  // 「＋ その他の名前で回答」ボタン（予定外の参加者向けフォールバック）
  const isOther = currentVal && !members.some(m => normalizeName(m) === normalizeName(currentVal));
  const otherBtn = document.createElement('button');
  otherBtn.type = 'button';
  otherBtn.className = `member-select-btn btn-other-name ${isOther ? 'selected' : ''}`;
  otherBtn.innerHTML = `<span>✏️ その他の名前で回答</span>`;
  otherBtn.addEventListener('click', () => {
    customWrap.classList.remove('hidden');
    userInput.value = isOther ? currentVal : '';
    chipsContainer.querySelectorAll('.member-select-btn').forEach(b => b.classList.remove('selected'));
    otherBtn.classList.add('selected');
    userInput.focus();
    syncResponseFormToName();
  });
  chipsContainer.appendChild(otherBtn);

  // 初回、もしメンバーが選ばれておらず input も空なら、あるいは現在の名前がメンバー外なら表示状態を同期
  if (isOther || !currentVal) {
    customWrap.classList.toggle('hidden', !isOther && members.length > 0);
  } else {
    customWrap.classList.add('hidden');
  }
}

function setRowSelection(candidateId, val) {
  const group = document.querySelector(`.vote-button-group[data-candidate-id="${candidateId}"]`);
  if (!group) return;
  group.querySelectorAll('.vote-radio-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.getAttribute('data-val') === val);
  });
}

// 回答者名に合わせて「ルールで除外された日程」を再判定し、入力不可（グレーアウト）にする。
// 同名の既存回答を見つけたときは、本人の回答を引き継いで再回答できるようにする。
function syncResponseFormToName() {
  const event = appState.currentEvent;
  if (!event) return;

  const name = document.getElementById('userName').value;
  const mine = name.trim()
    ? (event.responses || []).find(r => normalizeName(r.name) === normalizeName(name))
    : null;
  const prefill = !!mine && mine.id !== appState.syncedRespondentId;

  let deadCount = 0;
  event.candidates.forEach(c => {
    const row = document.querySelector(`.date-vote-item[data-candidate-id="${c.id}"]`);
    if (!row) return;
    const badge = row.querySelector('.dead-badge');
    const buttons = row.querySelectorAll('.vote-radio-btn');
    const reason = getDeadReason(c, event, name);

    if (reason) {
      deadCount++;
      delete appState.activeRespondentAnswers[c.id]; // 除外日程は回答を保存しない
      row.classList.add('is-dead');
      buttons.forEach(b => { b.disabled = true; b.classList.remove('selected'); });
      badge.textContent = `🚫 除外済み（${describeDeadReason(reason)}）`;
      badge.classList.remove('hidden');
      return;
    }

    row.classList.remove('is-dead');
    buttons.forEach(b => { b.disabled = false; });
    badge.classList.add('hidden');

    let val = prefill
      ? (mine.answers[c.id] || appState.activeRespondentAnswers[c.id])
      : appState.activeRespondentAnswers[c.id];
    if (!val) val = (mine && mine.answers[c.id]) || 'ok'; // 新規・復活時の既定は◯
    appState.activeRespondentAnswers[c.id] = val;
    setRowSelection(c.id, val);
  });
  appState.syncedRespondentId = mine ? mine.id : null;

  const total = event.candidates.length;
  const notice = document.getElementById('deadNotice');
  const submitBtn = document.getElementById('btnSubmitResponse');
  if (notice) {
    if (deadCount === 0) {
      notice.classList.add('hidden');
    } else {
      notice.classList.remove('hidden');
      notice.textContent = deadCount === total
        ? '🚫 すべての日程がルールで除外されました。主催者に相談してください。'
        : `🚫 ${deadCount}件の日程はイベントのルールで除外されているため、回答できません。`;
    }
  }
  if (submitBtn) submitBtn.disabled = deadCount === total;
}

function setAllAnswers(status) {
  const event = appState.currentEvent;
  if (!event) return;

  const name = document.getElementById('userName').value;
  let applied = 0;
  event.candidates.forEach(c => {
    if (getDeadReason(c, event, name)) return; // 除外日程はスキップ
    appState.activeRespondentAnswers[c.id] = status;
    setRowSelection(c.id, status);
    applied++;
  });

  const labelMap = { ok: '◯ (参加可能)', triangle: '△ (未定)', ng: '✕ (不参加)' };
  showToast(`回答できる${applied}件を ${labelMap[status]} に設定しました`, 'success');
}

async function handleSubmitResponse() {
  const nameInput = document.getElementById('userName');
  const commentInput = document.getElementById('userComment');
  const name = nameInput.value.trim();
  const comment = commentInput.value.trim();

  if (!name) {
    showToast('お名前を入力してください', 'error');
    nameInput.focus();
    return;
  }

  // ユーザー名をLocalStorageに記憶
  localStorage.setItem(STORAGE_KEYS.SAVED_NAME, name);

  const event = appState.currentEvent;
  if (!event) return;

  // 送信直前にも必ず再判定（除外日程を回答へ混入させない）
  syncResponseFormToName();
  if (Object.keys(appState.activeRespondentAnswers).length === 0) {
    showToast('回答できる日程がありません', 'error');
    return;
  }

  if (!event.responses) event.responses = [];

  // 既存の同名回答があれば更新、なければ新規追加
  const existingIdx = event.responses.findIndex(r => normalizeName(r.name) === normalizeName(name));
  const responseData = {
    id: existingIdx >= 0 ? event.responses[existingIdx].id : 'res_' + Date.now().toString(36),
    name: name,
    comment: comment,
    answers: { ...appState.activeRespondentAnswers },
    updatedAt: new Date().toISOString()
  };

  if (existingIdx >= 0) {
    event.responses[existingIdx] = responseData;
    showToast(`「${name}」さんの回答を更新しました！`, 'success');
  } else {
    event.responses.push(responseData);
    showToast(`「${name}」さんの回答を受け付けました！🎉`, 'success');
  }

  saveEventToStorage(event);
  renderEventBanner();
  renderMatrixTable();
  renderCommentsTimeline();
  updateBestDate();
  updateUrlHash();
  syncResponseFormToName();
  renderMemberSelectSection();

  commentInput.value = '';

  // クラウド同期
  if (typeof TomoApi !== 'undefined' && TomoApi.isCloudEnabled()) {
    try {
      await TomoApi.submitResponse(event.id, responseData);
    } catch (err) {
      console.warn('Cloud submitResponse failed, stored in localStorage cache', err);
      showToast('⚠️ クラウドへの同期が一時保留されました（端末内に保存済み）', 'info');
    }
  }

  // テーブル位置へスムーズスクロール
  document.getElementById('matrixTableContainer').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function renderCommentsTimeline() {
  const event = appState.currentEvent;
  const container = document.getElementById('commentsList');
  const commentsCard = document.getElementById('commentsCard');

  if (!event || !container) return;

  const comments = (event.responses || []).filter(r => r.comment && r.comment.trim().length > 0);

  if (comments.length === 0) {
    commentsCard.classList.add('hidden');
    return;
  }

  commentsCard.classList.remove('hidden');
  container.innerHTML = '';

  comments.forEach(c => {
    const bubble = document.createElement('div');
    bubble.className = 'comment-bubble';
    bubble.innerHTML = `
      <div class="comment-author">👤 ${escapeHtml(c.name)}</div>
      <div class="comment-content">${escapeHtml(c.comment)}</div>
    `;
    container.appendChild(bubble);
  });
}

function updateBestDate() {
  const event = appState.currentEvent;
  const bestDateCard = document.getElementById('bestDateCard');
  const bestDateText = document.getElementById('bestDateText');
  const bestDateStats = document.getElementById('bestDateStats');

  delete bestDateCard.dataset.bestCandidateId;
  delete bestDateCard.dataset.bestDateText;

  if (!event || !event.responses || event.responses.length === 0) {
    bestDateText.textContent = '出欠の回答を待っています';
    bestDateStats.textContent = '参加者の回答が集まると、一番都合の良い候補日を自動計算します。';
    return;
  }

  // フィルタ適用後・ルール除外を除いた候補の中から最上位を選ぶ
  const candidates = getFilteredCandidates().filter(c => !getDeadReason(c, event));
  if (candidates.length === 0) {
    const allDead = event.candidates.every(c => getDeadReason(c, event));
    bestDateText.textContent = allDead ? '全日程がルールで除外されました' : '条件に合う日程がありません';
    bestDateStats.textContent = allDead ? '前提ルールを見直すか、候補日を追加しましょう。' : '絞り込み条件をゆるめてみましょう。';
    return;
  }

  const scores = candidates.map(c => {
    const { ok, tri, ng } = countAnswers(c.id, event.responses);
    const score = (ok * 2) + (tri * 1);
    return { candidate: c, ok, tri, ng, score };
  });

  scores.sort((a, b) => b.score - a.score || b.ok - a.ok);

  const best = scores[0];
  if (best && best.score > 0) {
    const filterNote = isFilterActive() ? ' ※絞り込み条件内の最上位' : '';
    bestDateText.textContent = best.candidate.text;
    bestDateStats.textContent = `参加可能: ${best.ok}名 / 未定: ${best.tri}名 / 不参加: ${best.ng}名 (スコア: ${best.score}pt)${filterNote}`;
    bestDateCard.dataset.bestDateText = best.candidate.text;
    bestDateCard.dataset.bestCandidateId = best.candidate.id;
  } else {
    bestDateText.textContent = '候補日を調整中';
    bestDateStats.textContent = '全員が参加可能な日程を相談しましょう。';
  }
}

// =============================================================================
// Share & Export Features (URL, LINE, Calendar, QR)
// =============================================================================

function generateShareUrl() {
  if (!appState.currentEvent) return window.location.href;
  if (typeof TomoApi !== 'undefined') {
    return TomoApi.buildShareUrl(appState.currentEvent);
  }
  const jsonStr = JSON.stringify(appState.currentEvent);
  const base64Data = encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
  const baseUrl = window.location.origin + window.location.pathname;
  return `${baseUrl}#data=${base64Data}`;
}

function updateUrlHash() {
  if (!appState.currentEvent) return;
  try {
    if (typeof TomoApi !== 'undefined' && TomoApi.isCloudEnabled()) {
      window.location.hash = `#${appState.currentEvent.id}`;
      return;
    }
    const jsonStr = JSON.stringify(appState.currentEvent);
    const base64Data = encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
    window.location.hash = `data=${base64Data}`;
  } catch (err) {
    console.warn('URL hash update failed', err);
  }
}

async function loadEventFromUrl() {
  if (!window.location.hash) return false;

  // 1. クラウド短縮URL (#/e/{id}) の判定
  if (typeof TomoApi !== 'undefined') {
    const route = TomoApi.parseRoute();
    if (route && route.type === 'cloud') {
      showToast('☁️ イベントを読み込んでいます...', 'info');
      try {
        const cloudEvent = await TomoApi.getEvent(route.eventId);
        if (cloudEvent) {
          saveEventToStorage(cloudEvent);
          showEventDetail(cloudEvent);
          return true;
        }
      } catch (err) {
        console.warn('Failed to load from cloud, checking storage cache', err);
      }
      // キャッシュにあればそれを使う
      const cached = loadEventFromStorage();
      if (cached && cached.id === route.eventId) {
        showEventDetail(cached);
        showToast('⚠️ オフラインキャッシュを表示しています', 'info');
        return true;
      }
      showToast('イベントの取得に失敗しました。URLをご確認ください', 'error');
      return false;
    }
  }

  // 2. スタンドアロン ハッシュ (#data=...) の判定
  try {
    const hash = window.location.hash.substring(1);
    const match = hash.match(/data=([^&]+)/);
    if (match && match[1]) {
      const base64Data = decodeURIComponent(match[1]);
      const jsonStr = decodeURIComponent(escape(atob(base64Data)));
      const eventData = JSON.parse(jsonStr);
      if (eventData && eventData.title && eventData.candidates) {
        saveEventToStorage(eventData);
        showEventDetail(eventData);
        return true;
      }
    }
  } catch (err) {
    console.error('Failed to parse event from URL', err);
  }
  return false;
}

// -----------------------------------------------------------------------------
// バックグラウンド クラウド同期 (15秒ポーリング & タブ復帰時)
// -----------------------------------------------------------------------------
let cloudSyncTimer = null;

function startCloudSyncTimer() {
  if (cloudSyncTimer) clearInterval(cloudSyncTimer);
  if (typeof TomoApi === 'undefined' || !TomoApi.isCloudEnabled()) return;

  cloudSyncTimer = setInterval(async () => {
    if (!appState.currentEvent || !appState.currentEvent.id) return;
    try {
      const updated = await TomoApi.getEvent(appState.currentEvent.id);
      if (updated && hasEventChanged(appState.currentEvent, updated)) {
        console.log('Syncing updated event from cloud...');
        appState.currentEvent = { ...appState.currentEvent, ...updated };
        saveEventToStorage(appState.currentEvent);
        renderEventBanner();
        renderMatrixTable();
        renderCommentsTimeline();
        updateBestDate();
        syncResponseFormToName();
        renderMemberSelectSection();
      }
    } catch (e) {}
  }, 15000);
}

function hasEventChanged(current, updated) {
  const curResp = (current.responses || []).length;
  const updResp = (updated.responses || []).length;
  if (curResp !== updResp) return true;
  const curJson = JSON.stringify(current.responses || []);
  const updJson = JSON.stringify(updated.responses || []);
  return curJson !== updJson;
}

// スマホでLINE等からブラウザに復帰した時に即時再取得
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && appState.currentEvent && typeof TomoApi !== 'undefined' && TomoApi.isCloudEnabled()) {
    try {
      const updated = await TomoApi.getEvent(appState.currentEvent.id);
      if (updated && hasEventChanged(appState.currentEvent, updated)) {
        appState.currentEvent = { ...appState.currentEvent, ...updated };
        saveEventToStorage(appState.currentEvent);
        renderEventBanner();
        renderMatrixTable();
        renderCommentsTimeline();
        updateBestDate();
        syncResponseFormToName();
        renderMemberSelectSection();
      }
    } catch (e) {}
  }
});

function generateLineShareText() {
  const event = appState.currentEvent;
  if (!event) return '';

  const shareUrl = generateShareUrl();
  let text = `📅【日程調整のお願い】${event.title}\n\n`;
  if (event.description) {
    text += `${event.description}\n\n`;
  }
  text += `候補日:\n`;
  event.candidates.forEach(c => {
    text += `・${c.text}\n`;
  });
  text += `\n以下のリンクから出欠（◯・△・✕）の入力をお願いします！👇\n${shareUrl}`;
  return text;
}

function copyShareUrl() {
  const url = generateShareUrl();
  navigator.clipboard.writeText(url).then(() => {
    showToast('🔗 共有用URLをクリップボードにコピーしました！', 'success');
  }).catch(() => {
    prompt('URLをコピーしてください:', url);
  });
}

function copyLineMessage() {
  const text = generateLineShareText();
  navigator.clipboard.writeText(text).then(() => {
    showToast('💬 LINE用メッセージをコピーしました！トーク画面に貼り付けられます', 'success');
  }).catch(() => {
    prompt('以下の文面をコピーしてください:', text);
  });
}

function openShareModal() {
  const modal = document.getElementById('shareModal');
  const urlInput = document.getElementById('shareUrlInput');
  const linePreview = document.getElementById('lineMessagePreview');
  const qrContainer = document.getElementById('qrCodeContainer');

  const shareUrl = generateShareUrl();
  urlInput.value = shareUrl;
  linePreview.value = generateLineShareText();

  // QRコード生成
  qrContainer.innerHTML = '';
  if (window.QRCode) {
    try {
      new QRCode(qrContainer, {
        text: shareUrl,
        width: 140,
        height: 140,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      console.warn('QR code gen failed', e);
    }
  }

  modal.classList.remove('hidden');
}

function closeShareModal() {
  document.getElementById('shareModal').classList.add('hidden');
}

// 候補から日付・時刻を解決する。構造化データがない旧イベントは text から推定する
function resolveCandidateSchedule(c) {
  let date = c.date || c.rawDate || '';
  let start = c.start || '';
  let end = c.end || '';

  if (!date) {
    const md = (c.text || '').match(/(\d{1,2})月(\d{1,2})日/);
    if (md) date = inferDateFromMonthDay(Number(md[1]), Number(md[2]));
  }
  if (!start) {
    const time = parseTimeRange(c.text || '');
    if (time) { start = time.start; end = time.end; }
  }
  return { date, start, end };
}

// =============================================================================
// Phase 2: Calendar (.ics / Google) & Image Share (html2canvas / Web Share)
// =============================================================================

function getBestCandidate(event) {
  if (!event) return null;
  const bestDateCard = document.getElementById('bestDateCard');
  if (bestDateCard && bestDateCard.dataset.bestCandidateId) {
    const found = (event.candidates || []).find(c => c.id === bestDateCard.dataset.bestCandidateId);
    if (found) return found;
  }
  // フィルタとルール除外を考慮した最上位
  const validCandidates = (event.candidates || []).filter(c => !getDeadReason(c, event));
  if (validCandidates.length === 0) return (event.candidates && event.candidates[0]) || null;
  
  const responses = event.responses || [];
  const scores = validCandidates.map(c => {
    const { ok, tri } = countAnswers(c.id, responses);
    return { candidate: c, score: (ok * 2) + tri };
  });
  scores.sort((a, b) => b.score - a.score);
  return scores[0] ? scores[0].candidate : validCandidates[0];
}

function addToGoogleCalendar() {
  const event = appState.currentEvent;
  if (!event) return;

  const candidate = getBestCandidate(event);
  if (!candidate) {
    showToast('カレンダーに追加できる日程がありません', 'error');
    return;
  }

  const { date, start, end } = resolveCandidateSchedule(candidate);
  if (!date) {
    showToast('この候補は日付を特定できないため登録できません', 'error');
    return;
  }

  const ymd = date.replace(/-/g, '');
  let startDateStr;
  let endDateStr;
  if (start) {
    startDateStr = `${ymd}T${start.replace(':', '')}00`;
    endDateStr = `${ymd}T${(end || addMinutesHHMM(start, 120)).replace(':', '')}00`;
  } else {
    // 終日イベントの終了日は翌日（Googleカレンダーの仕様）
    const next = new Date(date + 'T00:00:00');
    next.setDate(next.getDate() + 1);
    startDateStr = ymd;
    endDateStr = formatDateYMD(next).replace(/-/g, '');
  }

  const title = encodeURIComponent(event.title);
  const details = encodeURIComponent((event.description ? event.description + '\n\n' : '') + 'TomoPlanで決定した日程です。');
  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDateStr}/${endDateStr}&details=${details}`;

  window.open(gcalUrl, '_blank');
}

function generateIcsContent(candidate, event) {
  const { date, start, end } = resolveCandidateSchedule(candidate);
  if (!date) return null;

  const ymd = date.replace(/-/g, '');
  const now = new Date();
  const formatUtcIso = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const dtstamp = formatUtcIso(now);
  const uid = `tomoplan-${event.id}-${candidate.id || 'best'}-${Date.now()}@tomoplan.local`;

  let dtstartLine, dtendLine;
  if (start) {
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = (end || addMinutesHHMM(start, 120)).split(':').map(Number);
    const [y, m, d] = date.split('-').map(Number);

    // 日本時間(UTC+9)をUTCに換算
    const startUtc = new Date(Date.UTC(y, m - 1, d, sH - 9, sM, 0));
    const endUtc = new Date(Date.UTC(y, m - 1, d, eH - 9, eM, 0));

    dtstartLine = `DTSTART:${formatUtcIso(startUtc)}`;
    dtendLine = `DTEND:${formatUtcIso(endUtc)}`;
  } else {
    // 終日イベント: DTSTART;VALUE=DATE:YYYYMMDD, DTEND は翌日
    const next = new Date(date + 'T00:00:00');
    next.setDate(next.getDate() + 1);
    const nextYmd = formatDateYMD(next).replace(/-/g, '');
    dtstartLine = `DTSTART;VALUE=DATE:${ymd}`;
    dtendLine = `DTEND;VALUE=DATE:${nextYmd}`;
  }

  const responses = event.responses || [];
  const okNames = responses.filter(r => r.answers && r.answers[candidate.id] === 'ok').map(r => r.name);
  const triNames = responses.filter(r => r.answers && r.answers[candidate.id] === 'triangle').map(r => r.name);

  let desc = (event.description ? event.description + '\n\n' : '');
  desc += `【決定候補日程】${candidate.text}\n`;
  if (okNames.length > 0) desc += `【参加可能 (${okNames.length}名)】${okNames.join(', ')}\n`;
  if (triNames.length > 0) desc += `【未定 (${triNames.length}名)】${triNames.join(', ')}\n`;
  desc += `\nTomoPlanで調整された予定です。\nイベントURL: ${generateShareUrl()}`;

  const cleanSummary = (event.title || 'イベント').replace(/[,;\\]/g, '\\$&');
  const cleanDesc = desc.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TomoPlan//Event Calendar//JA',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    dtstartLine,
    dtendLine,
    `SUMMARY:${cleanSummary}`,
    `DESCRIPTION:${cleanDesc}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

function handleExportBestIcs() {
  const event = appState.currentEvent;
  if (!event) return;
  const bestCandidate = getBestCandidate(event);
  if (!bestCandidate) {
    showToast('カレンダーに追加できる日程がありません', 'error');
    return;
  }
  downloadIcsFile(bestCandidate, event);
}

function downloadIcsFile(candidate, event) {
  const ics = generateIcsContent(candidate, event);
  if (!ics) {
    showToast('この候補は日付を特定できないためカレンダーファイルを作成できません', 'error');
    return;
  }

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const filename = `tomoplan_${(event.title || 'schedule').replace(/[\/\\:*?"<>|]/g, '_')}.ics`;
  downloadBlob(blob, filename);

  showToast('🍏 カレンダーファイル (.ics) を保存しました！開いて追加してください', 'success');
}

// -----------------------------------------------------------------------------
// シェア画像生成 (html2canvas / Web Share API)
// -----------------------------------------------------------------------------

let currentPreviewBlob = null;
let currentPreviewFileName = '';

function renderShareCardDom(event) {
  const container = document.getElementById('shareCardTarget');
  if (!container) return;

  const responses = event.responses || [];
  const candidates = event.candidates || [];
  const best = getBestCandidate(event);

  let bestOkNames = [];
  let bestStats = { ok: 0, tri: 0, ng: 0, score: 0 };
  if (best) {
    bestStats = countAnswers(best.id, responses);
    bestStats.score = (bestStats.ok * 2) + bestStats.tri;
    bestOkNames = responses.filter(r => r.answers && r.answers[best.id] === 'ok').map(r => r.name);
  }

  // 候補日程テーブルの生成
  let candidateRowsHtml = '';
  candidates.forEach(c => {
    const { ok, tri, ng } = countAnswers(c.id, responses);
    const deadReason = getDeadReason(c, event);
    const isBestRow = best && c.id === best.id && !deadReason;
    const totalVotes = ok + tri + ng;
    const okPct = totalVotes > 0 ? (ok / totalVotes) * 100 : 0;
    const triPct = totalVotes > 0 ? (tri / totalVotes) * 100 : 0;
    const ngPct = totalVotes > 0 ? (ng / totalVotes) * 100 : 0;

    candidateRowsHtml += `
      <tr class="${isBestRow ? 'sc-row-best' : ''} ${deadReason ? 'sc-row-dead' : ''}">
        <td class="sc-date-col">
          ${isBestRow ? '👑 ' : ''}${escapeHtml(c.text)}
          ${deadReason ? ` <small style="color:#ef4444;">(${describeDeadReason(deadReason)})</small>` : ''}
        </td>
        <td class="sc-stat-col">
          <span style="color:#059669; font-weight:700;">◯ ${ok}</span>
          <span style="color:#d97706; font-weight:700; margin-left:4px;">△ ${tri}</span>
          <span style="color:#dc2626; font-weight:700; margin-left:4px;">✕ ${ng}</span>
        </td>
        <td class="sc-rate-col">
          <div class="sc-bar-wrap">
            <div class="sc-bar-ok" style="width:${okPct}%"></div>
            <div class="sc-bar-tri" style="width:${triPct}%"></div>
            <div class="sc-bar-ng" style="width:${ngPct}%"></div>
          </div>
        </td>
      </tr>
    `;
  });

  // 参加者コメント（最大3件抜粋）
  const comments = responses.filter(r => r.comment && r.comment.trim().length > 0).slice(0, 3);
  let commentsHtml = '';
  if (comments.length > 0) {
    commentsHtml = `
      <div class="sc-comments-wrap">
        <div class="sc-section-heading">💬 参加者からのコメント</div>
        <div class="sc-comment-list">
          ${comments.map(c => `
            <div class="sc-comment-item">
              <div class="sc-comment-author">👤 ${escapeHtml(c.name)}</div>
              <div class="sc-comment-text">${escapeHtml(c.comment)}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const shareUrl = generateShareUrl();

  container.innerHTML = `
    <div class="sc-header">
      <div class="sc-brand">
        <div class="sc-brand-icon">📅</div>
        <div>
          <div class="sc-brand-name">TomoPlan</div>
          <div class="sc-brand-sub">友達とサクッと決まる日程調整</div>
        </div>
      </div>
      <div class="sc-report-badge">📊 日程調整レポート</div>
    </div>

    <div class="sc-event-section">
      <h2 class="sc-event-title">${escapeHtml(event.title)}</h2>
      ${event.description ? `<div class="sc-event-desc">${escapeHtml(event.description)}</div>` : ''}
    </div>

    ${best ? `
      <div class="sc-hero">
        <div class="sc-hero-top">
          <div class="sc-hero-badge">🏆 一番人気・おすすめの日程</div>
          <div class="sc-hero-votes">
            <span class="sc-ok">◯ ${bestStats.ok}名</span>
            <span class="sc-tri">△ ${bestStats.tri}名</span>
            <span class="sc-ng">✕ ${bestStats.ng}名</span>
          </div>
        </div>
        <div class="sc-hero-date">${escapeHtml(best.text)}</div>
        <div class="sc-hero-members">
          <strong>参加可能 (${bestOkNames.length}名):</strong> ${bestOkNames.length > 0 ? escapeHtml(bestOkNames.join(', ')) : '（まだ回答がありません）'}
        </div>
      </div>
    ` : ''}

    <div class="sc-section-heading">📅 候補日程の集計一覧 (${responses.length}名回答)</div>
    <table class="sc-table">
      <thead>
        <tr>
          <th>候補日程</th>
          <th>出欠状況</th>
          <th>割合</th>
        </tr>
      </thead>
      <tbody>
        ${candidateRowsHtml}
      </tbody>
    </table>

    ${commentsHtml}

    <div class="sc-footer">
      <div class="sc-footer-info">
        <div class="sc-footer-brand">TomoPlan で作成・集計</div>
        <div>登録不要・完全無料のスマートな日程調整</div>
        <div style="font-size:9px; color:#94a3b8; margin-top:2px;">URLまたは右記QRコードから回答・確認できます</div>
      </div>
      <div class="sc-qr-box">
        <div id="scQrContainer" class="sc-qr-canvas"></div>
        <span class="sc-qr-hint">QRでイベントを開く</span>
      </div>
    </div>
  `;

  // QRコード描画
  const qrBox = document.getElementById('scQrContainer');
  if (qrBox && window.QRCode) {
    try {
      new QRCode(qrBox, {
        text: shareUrl,
        width: 60,
        height: 60,
        colorDark: '#0f172a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    } catch (e) {
      console.warn('Share card QR code gen failed', e);
    }
  }
}

async function exportSummaryImage() {
  const event = appState.currentEvent;
  if (!event) return;

  if (typeof html2canvas === 'undefined') {
    showToast('画像生成ライブラリを読み込み中です。少々お待ちください', 'info');
    return;
  }

  showToast('📸 シェア画像を生成しています...', 'info');

  try {
    // 1. オフスクリーンカードを描画
    renderShareCardDom(event);

    // 2. Webフォント読み込み完了を待機
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch (e) {}
    }

    // QRコード描画のための微小ディレイ
    await new Promise(resolve => setTimeout(resolve, 150));

    const target = document.getElementById('shareCardTarget');
    if (!target) return;

    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false
    });

    canvas.toBlob(async (blob) => {
      if (!blob) {
        showToast('画像生成に失敗しました', 'error');
        return;
      }

      currentPreviewBlob = blob;
      currentPreviewFileName = `tomoplan_${(event.title || 'schedule').replace(/[\/\\:*?"<>|]/g, '_')}.png`;
      const file = new File([blob], currentPreviewFileName, { type: 'image/png' });

      // Web Share API (スマホ端末のLINEや写真共有に直接送れる)
      const canShareFile = !!(navigator.canShare && navigator.canShare({ files: [file] }));
      
      if (canShareFile) {
        try {
          await navigator.share({
            title: event.title,
            text: `【TomoPlan】${event.title} の日程調整結果です！`,
            files: [file]
          });
          showToast('LINEやアプリに共有しました！🎉', 'success');
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn('Web Share API error, opening preview modal', err);
        }
      }

      // フォールバック: プレビューモーダル表示 & ダウンロード実行
      openImagePreviewModal(canvas.toDataURL('image/png'), currentPreviewFileName, canShareFile);
      downloadBlob(blob, currentPreviewFileName);
      showToast('📸 画像を保存しました！LINEのアルバムやトークに貼れます', 'success');
    }, 'image/png');

  } catch (err) {
    console.error('Image export error', err);
    showToast('画像生成中にエラーが発生しました', 'error');
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function openImagePreviewModal(dataUrl, fileName, canShare) {
  const modal = document.getElementById('imagePreviewModal');
  const img = document.getElementById('imagePreviewImg');
  const shareBtn = document.getElementById('btnPreviewShare');

  if (img) img.src = dataUrl;
  if (shareBtn) shareBtn.classList.toggle('hidden', !canShare);
  if (modal) modal.classList.remove('hidden');
}

function closeImagePreviewModal() {
  const modal = document.getElementById('imagePreviewModal');
  if (modal) modal.classList.add('hidden');
}

function handleDownloadPreviewImage() {
  if (currentPreviewBlob && currentPreviewFileName) {
    downloadBlob(currentPreviewBlob, currentPreviewFileName);
    showToast('画像を再ダウンロードしました', 'success');
  }
}

async function handleSharePreviewImage() {
  const event = appState.currentEvent;
  if (!currentPreviewBlob || !event) return;
  const file = new File([currentPreviewBlob], currentPreviewFileName, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: event.title,
        text: `【TomoPlan】${event.title} の日程調整結果です！`,
        files: [file]
      });
    } catch (e) {}
  }
}

// =============================================================================
// Edit Event Meta
// =============================================================================

function openEditModal() {
  const event = appState.currentEvent;
  if (!event) return;

  document.getElementById('editEventTitle').value = event.title;
  document.getElementById('editEventDescription').value = event.description || '';
  document.getElementById('editEventMembers').value = (event.members || []).join(', ');
  const rules = normalizeRules(event.rules);
  document.getElementById('editRuleExcludeNg').checked = rules.excludeIfAnyNg;
  document.getElementById('editRuleRequired').value = rules.requiredNames.join(', ');
  document.getElementById('editEventModal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('editEventModal').classList.add('hidden');
}

async function handleSaveEditEvent() {
  const title = document.getElementById('editEventTitle').value.trim();
  const desc = document.getElementById('editEventDescription').value.trim();
  const rawMembers = document.getElementById('editEventMembers').value;

  if (!title) {
    showToast('イベント名を入力してください', 'error');
    return;
  }

  const parsedMembers = rawMembers
    .split(/[,、\n\r\t\s\u3000]+/)
    .map(s => s.trim())
    .filter(Boolean);

  appState.currentEvent.title = title;
  appState.currentEvent.description = desc;
  appState.currentEvent.members = parsedMembers;
  appState.currentEvent.schemaVersion = SCHEMA_VERSION;
  appState.currentEvent.rules = normalizeRules({
    excludeIfAnyNg: document.getElementById('editRuleExcludeNg').checked,
    requiredNames: document.getElementById('editRuleRequired').value
      .split(/[,、\n\r\t\s\u3000]+/)
      .map(s => s.trim())
      .filter(Boolean)
  });

  saveEventToStorage(appState.currentEvent);
  renderEventBanner();
  // ルール変更やメンバー変更は表示時に再判定される
  renderMatrixTable();
  updateBestDate();
  syncResponseFormToName();
  renderMemberSelectSection();
  updateUrlHash();
  closeEditModal();
  showToast('イベント情報を更新しました', 'success');

  if (typeof TomoApi !== 'undefined' && TomoApi.isCloudEnabled()) {
    try {
      const editToken = TomoApi.getEditToken(appState.currentEvent.id);
      await TomoApi.updateEvent(appState.currentEvent.id, appState.currentEvent, editToken);
    } catch (err) {
      console.warn('Cloud updateEvent failed', err);
    }
  }
}

// =============================================================================
// History & Storage
// =============================================================================

function saveEventToStorage(eventData) {
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_EVENT, JSON.stringify(eventData));

    // 履歴リストの更新
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
    } catch (e) { history = []; }

    const idx = history.findIndex(h => h.id === eventData.id);
    if (idx >= 0) {
      history[idx] = eventData;
    } else {
      history.unshift(eventData);
    }
    // 最大15件保存
    if (history.length > 15) history = history.slice(0, 15);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
  } catch (err) {
    console.warn('Storage save failed', err);
  }
}

function loadEventFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_EVENT);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    return null;
  }
}

function openHistoryModal() {
  const modal = document.getElementById('historyModal');
  const container = document.getElementById('historyListContainer');

  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
  } catch (e) { history = []; }

  container.innerHTML = '';

  if (history.length === 0) {
    container.innerHTML = '<p class="empty-hint">保存された履歴はありません。</p>';
  } else {
    history.forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';
      const created = new Date(item.createdAt).toLocaleDateString('ja-JP');
      const respCount = item.responses ? item.responses.length : 0;
      div.innerHTML = `
        <div>
          <div class="history-title">${escapeHtml(item.title)}</div>
          <div class="history-date">作成日: ${created} / 回答: ${respCount}名 / 候補日: ${item.candidates.length}件</div>
        </div>
        <button class="btn btn-secondary btn-sm">開く</button>
      `;
      div.addEventListener('click', () => {
        showEventDetail(item);
        closeHistoryModal();
      });
      container.appendChild(div);
    });
  }

  modal.classList.remove('hidden');
}

function closeHistoryModal() {
  document.getElementById('historyModal').classList.add('hidden');
}

// =============================================================================
// Demo Data Loader
// =============================================================================

function loadDemoData() {
  // 1週間以上先の金曜を基準に、金・土・日と翌週土曜の候補を作る
  const base = new Date();
  base.setDate(base.getDate() + 7 + ((5 - base.getDay() + 7) % 7));
  const dayAt = (offset) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    return formatDateYMD(d);
  };
  const demoCandidate = (id, offset, label) => ({ ...buildCandidate(dayAt(offset), label), id });

  const demoEvent = {
    id: 'demo_' + Date.now().toString(36),
    title: '🍻 週末の秋の味覚ごはん会！',
    description: '新宿か渋谷周辺で美味しい秋刀魚やきのこ料理を食べに行きましょう〜！予算は4,500円前後の予定です🍁',
    createdAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
    // 事前登録メンバー一覧
    members: ['幹事・けんた', 'さくら', 'ダイキ', 'ゆい'],
    // デモ設定: 「さくら」が必須参加者。さくらが✕を付けた日程(c1, c4)は自動で除外・グレーアウトされる
    rules: { excludeIfAnyNg: false, requiredNames: ['さくら'] },
    candidates: [
      demoCandidate('c1', 0, '夜 (19:00〜)'),
      demoCandidate('c2', 1, '12:30〜'),
      demoCandidate('c3', 1, '18:30〜'),
      demoCandidate('c4', 2, '13:00〜'),
      demoCandidate('c5', 8, '夜 (18:00〜)')
    ],
    responses: [
      {
        id: 'r1',
        name: '幹事・けんた',
        comment: '土曜の夜ならどこでも大丈夫です！お店予約します',
        answers: { c1: 'triangle', c2: 'ok', c3: 'ok', c4: 'triangle', c5: 'ok' },
        updatedAt: new Date().toISOString()
      },
      {
        id: 'r2',
        name: 'さくら',
        comment: '土曜の夜がいちばん都合良いです🌸',
        answers: { c1: 'ng', c2: 'triangle', c3: 'ok', c4: 'ng', c5: 'ok' },
        updatedAt: new Date().toISOString()
      },
      {
        id: 'r3',
        name: 'ダイキ',
        comment: '金曜は残業の可能性あり。土日はフルで空いてます！',
        answers: { c1: 'triangle', c2: 'ok', c3: 'ok', c4: 'ok', c5: 'ok' },
        updatedAt: new Date().toISOString()
      },
      {
        id: 'r4',
        name: 'ゆい',
        comment: '日曜昼もいいですね〜！楽しみです',
        answers: { c1: 'ng', c2: 'ok', c3: 'ok', c4: 'ok', c5: 'triangle' },
        updatedAt: new Date().toISOString()
      }
    ]
  };

  saveEventToStorage(demoEvent);
  showEventDetail(demoEvent);
  showToast('✨ サンプルのごはん会イベントを読み込みました！', 'success');
}

// =============================================================================
// Toast Notification Utility
// =============================================================================

function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const icon = type === 'success' ? '✅' : '⚠️';
  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 3200);
}

// =============================================================================
// HTML Sanitization
// =============================================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
