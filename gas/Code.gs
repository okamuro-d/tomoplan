/**
 * TomoPlan - Google Apps Script (GAS) Backend API
 * 完全無料で動作する Google スプレッドシート連携 バックエンド
 * 
 * 【シート構成】
 * 1. Events: イベント基本情報・前提ルール・参加予定メンバー
 * 2. Candidates: 候補日程リスト
 * 3. Responses: 参加者の回答・コメント
 */

const SHEET_NAMES = {
  EVENTS: 'Events',
  CANDIDATES: 'Candidates',
  RESPONSES: 'Responses'
};

// -----------------------------------------------------------------------------
// 初期セットアップ関数
// GASエディタでこの関数を選択して「実行」を押すと、必要なシートとヘッダーが自動作成されます
// -----------------------------------------------------------------------------
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const configs = [
    {
      name: SHEET_NAMES.EVENTS,
      headers: ['eventId', 'title', 'description', 'members', 'rules', 'createdAt', 'status', 'decidedCandidateId', 'editToken']
    },
    {
      name: SHEET_NAMES.CANDIDATES,
      headers: ['eventId', 'candidateId', 'text', 'date', 'start', 'end', 'allDay', 'sort']
    },
    {
      name: SHEET_NAMES.RESPONSES,
      headers: ['eventId', 'respondentId', 'name', 'answers', 'comment', 'updatedAt']
    }
  ];

  configs.forEach(cfg => {
    let sheet = ss.getSheetByName(cfg.name);
    if (!sheet) {
      sheet = ss.insertSheet(cfg.name);
    }
    // ヘッダー行の設定
    sheet.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers]);
    sheet.getRange(1, 1, 1, cfg.headers.length)
      .setFontWeight('bold')
      .setBackground('#f1f5f9')
      .setFontColor('#0f172a');
    sheet.setFrozenRows(1);
  });

  Logger.log('🎉 TomoPlan のシートセットアップが完了しました！');
}

// -----------------------------------------------------------------------------
// GET リクエスト処理 (イベント情報・回答一覧の取得)
// -----------------------------------------------------------------------------
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const eventId = params.id || params.eventId;

    if (!eventId) {
      return jsonResponse({
        success: true,
        message: 'TomoPlan GAS API is running.',
        timestamp: new Date().toISOString()
      });
    }

    const event = fetchFullEvent(eventId);
    if (!event) {
      return jsonResponse({ success: false, error: 'イベントが見つかりません' });
    }

    return jsonResponse({ success: true, event: event });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

// -----------------------------------------------------------------------------
// POST リクエスト処理 (イベント作成・回答送信・イベント編集)
// ※ CORS preflight を回避するため text/plain 形式で JSON を受け取ります
// -----------------------------------------------------------------------------
function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    // 最大10秒間ロックを待機（同時書き込み競合を防止）
    lock.waitLock(10000);
  } catch (lockErr) {
    return jsonResponse({ success: false, error: 'サーバーが混み合っています。少し待って再試行してください。' });
  }

  try {
    const contents = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const body = JSON.parse(contents);
    const action = body.action;

    let result = { success: false, error: '不明なアクションです' };

    switch (action) {
      case 'createEvent':
        result = handleCreateEvent(body);
        break;
      case 'submitResponse':
        result = handleSubmitResponse(body);
        break;
      case 'updateEvent':
        result = handleUpdateEvent(body);
        break;
      case 'getEvent':
        const event = fetchFullEvent(body.eventId);
        result = event ? { success: true, event } : { success: false, error: 'イベントが見つかりません' };
        break;
      default:
        result = { success: false, error: `未対応のアクション: ${action}` };
    }

    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

// -----------------------------------------------------------------------------
// アクション処理: イベント作成
// -----------------------------------------------------------------------------
function handleCreateEvent(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENTS);
  const candSheet = ss.getSheetByName(SHEET_NAMES.CANDIDATES);

  if (!eventSheet || !candSheet) {
    setupSheets();
  }

  const eventId = data.id || ('evt_' + Utilities.getUuid().substring(0, 10));
  const editToken = 'tk_' + Utilities.getUuid().substring(0, 16);
  const nowIso = new Date().toISOString();

  // Events シートに追加
  eventSheet.appendRow([
    eventId,
    data.title || '無題のイベント',
    data.description || '',
    JSON.stringify(data.members || []),
    JSON.stringify(data.rules || { excludeIfAnyNg: false, requiredNames: [] }),
    nowIso,
    'active',
    data.decidedCandidateId || '',
    editToken
  ]);

  // Candidates シートに追加
  const candidates = data.candidates || [];
  candidates.forEach((c, idx) => {
    candSheet.appendRow([
      eventId,
      c.id || ('c_' + idx),
      c.text || '',
      c.date || '',
      c.start || '',
      c.end || '',
      c.allDay ? 'true' : 'false',
      idx
    ]);
  });

  return {
    success: true,
    eventId: eventId,
    editToken: editToken,
    createdAt: nowIso
  };
}

// -----------------------------------------------------------------------------
// アクション処理: 出欠回答の保存 (Upsert: 同名回答は上書き)
// -----------------------------------------------------------------------------
function handleSubmitResponse(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const respSheet = ss.getSheetByName(SHEET_NAMES.RESPONSES);
  if (!respSheet) setupSheets();

  const eventId = data.eventId;
  const name = String(data.name || '').trim();
  const respondentId = data.respondentId || ('res_' + Utilities.getUuid().substring(0, 8));
  const answersJson = JSON.stringify(data.answers || {});
  const comment = data.comment || '';
  const nowIso = new Date().toISOString();

  if (!eventId || !name) {
    return { success: false, error: 'イベントIDとお名前は必須です' };
  }

  // 既存の同名回答を検索（NFKC正規化 & 空白除外で照合）
  const normName = normalizeNameForMatch(name);
  const values = respSheet.getDataRange().getValues();
  let existingRow = -1;

  for (let i = 1; i < values.length; i++) {
    const rowEventId = String(values[i][0]);
    const rowName = String(values[i][2]);
    if (rowEventId === eventId && normalizeNameForMatch(rowName) === normName) {
      existingRow = i + 1; // 1-indexed
      break;
    }
  }

  if (existingRow > 0) {
    // 既存行を更新
    respSheet.getRange(existingRow, 3, 1, 4).setValues([[
      name, // 最新の名前表記で更新
      answersJson,
      comment,
      nowIso
    ]]);
  } else {
    // 新規行を追加
    respSheet.appendRow([
      eventId,
      respondentId,
      name,
      answersJson,
      comment,
      nowIso
    ]);
  }

  return { success: true, respondentId: respondentId, updatedAt: nowIso };
}

// -----------------------------------------------------------------------------
// アクション処理: イベント情報・ルールの更新 (editToken で保護)
// -----------------------------------------------------------------------------
function handleUpdateEvent(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENTS);
  const eventId = data.eventId || data.id;
  const editToken = data.editToken;

  if (!eventId) return { success: false, error: 'イベントIDが指定されていません' };

  const values = eventSheet.getDataRange().getValues();
  let targetRow = -1;

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][0]) === eventId) {
      targetRow = i + 1;
      const rowToken = String(values[i][8]);
      if (editToken && rowToken && editToken !== rowToken) {
        return { success: false, error: '編集権限（editToken）が一致しません' };
      }
      break;
    }
  }

  if (targetRow <= 0) return { success: false, error: 'イベントが見つかりません' };

  // 更新可能項目の反映
  if (data.title !== undefined) eventSheet.getRange(targetRow, 2).setValue(data.title);
  if (data.description !== undefined) eventSheet.getRange(targetRow, 3).setValue(data.description);
  if (data.members !== undefined) eventSheet.getRange(targetRow, 4).setValue(JSON.stringify(data.members));
  if (data.rules !== undefined) eventSheet.getRange(targetRow, 5).setValue(JSON.stringify(data.rules));
  if (data.decidedCandidateId !== undefined) eventSheet.getRange(targetRow, 8).setValue(data.decidedCandidateId);

  return { success: true };
}

// -----------------------------------------------------------------------------
// ヘルパー: イベント情報の全取得 (イベント＋候補＋全回答を結合して返却)
// -----------------------------------------------------------------------------
function fetchFullEvent(eventId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventSheet = ss.getSheetByName(SHEET_NAMES.EVENTS);
  const candSheet = ss.getSheetByName(SHEET_NAMES.CANDIDATES);
  const respSheet = ss.getSheetByName(SHEET_NAMES.RESPONSES);

  if (!eventSheet || !candSheet) return null;

  // 1. Events シート検索
  const evValues = eventSheet.getDataRange().getValues();
  let eventMeta = null;
  for (let i = 1; i < evValues.length; i++) {
    if (String(evValues[i][0]) === eventId) {
      let members = [];
      let rules = { excludeIfAnyNg: false, requiredNames: [] };
      try { members = JSON.parse(evValues[i][3] || '[]'); } catch (e) {}
      try { rules = JSON.parse(evValues[i][4] || '{}'); } catch (e) {}

      eventMeta = {
        id: String(evValues[i][0]),
        title: String(evValues[i][1] || ''),
        description: String(evValues[i][2] || ''),
        members: members,
        rules: rules,
        createdAt: String(evValues[i][5] || ''),
        status: String(evValues[i][6] || 'active'),
        decidedCandidateId: String(evValues[i][7] || '')
      };
      break;
    }
  }

  if (!eventMeta) return null;

  // 2. Candidates シート検索
  const candValues = candSheet.getDataRange().getValues();
  const candidates = [];
  for (let i = 1; i < candValues.length; i++) {
    if (String(candValues[i][0]) === eventId) {
      candidates.push({
        id: String(candValues[i][1]),
        text: String(candValues[i][2] || ''),
        date: String(candValues[i][3] || ''),
        start: String(candValues[i][4] || ''),
        end: String(candValues[i][5] || ''),
        allDay: String(candValues[i][6]) === 'true',
        sort: Number(candValues[i][7]) || 0
      });
    }
  }
  candidates.sort((a, b) => a.sort - b.sort);
  eventMeta.candidates = candidates;

  // 3. Responses シート検索
  const responses = [];
  if (respSheet) {
    const respValues = respSheet.getDataRange().getValues();
    for (let i = 1; i < respValues.length; i++) {
      if (String(respValues[i][0]) === eventId) {
        let answers = {};
        try { answers = JSON.parse(respValues[i][3] || '{}'); } catch (e) {}
        responses.push({
          id: String(respValues[i][1]),
          name: String(respValues[i][2]),
          answers: answers,
          comment: String(respValues[i][4] || ''),
          updatedAt: String(respValues[i][5] || '')
        });
      }
    }
  }
  eventMeta.responses = responses;

  return eventMeta;
}

// -----------------------------------------------------------------------------
// ユーティリティ
// -----------------------------------------------------------------------------
function normalizeNameForMatch(name) {
  return String(name || '').toLowerCase().replace(/\s+/g, '');
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
