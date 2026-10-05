/**
 * TomoPlan - API Client & Data Synchronization Layer
 * 
 * Google Apps Script (GAS) 連携時:
 *   - クラウド同期 (Googleスプレッドシート)
 *   - 短縮URL (#/e/{eventId})
 *   - 15秒間隔ポーリング & タブ復帰時自動同期
 * 
 * 未設定（スタンドアロン）時:
 *   - LocalStorage & URLハッシュ(#data=...) による完全ローカル動作 (フォールバック)
 */

const TomoApi = (function () {
  'use strict';

  function isCloudEnabled() {
    return Boolean(typeof CONFIG !== 'undefined' && CONFIG && CONFIG.GAS_API_URL && CONFIG.GAS_API_URL.trim().length > 0);
  }

  function getApiEndpoint() {
    return isCloudEnabled() ? CONFIG.GAS_API_URL.trim() : '';
  }

  // ---------------------------------------------------------------------------
  // 低レベル GAS 通信 (CORS preflight 回避のため text/plain POST)
  // ---------------------------------------------------------------------------
  async function callGasApi(payload) {
    const endpoint = getApiEndpoint();
    if (!endpoint) throw new Error('GAS endpoint is not configured');

    const res = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload)
      // Note: Content-Type を指定しない、または text/plain にすることで
      // ブラウザが preflight OPTIONS を送るのを回避（GASの必須対応）
    });

    if (!res.ok) {
      throw new Error(`API 通信エラー: HTTP ${res.status}`);
    }

    const json = await res.json();
    return json;
  }

  // ---------------------------------------------------------------------------
  // 公開 API メソッド
  // ---------------------------------------------------------------------------

  /**
   * イベント作成
   */
  async function createEvent(eventData) {
    if (!isCloudEnabled()) {
      return {
        success: true,
        eventId: eventData.id,
        isLocal: true
      };
    }

    const payload = {
      action: 'createEvent',
      id: eventData.id,
      title: eventData.title,
      description: eventData.description,
      members: eventData.members || [],
      rules: eventData.rules || { excludeIfAnyNg: false, requiredNames: [] },
      candidates: eventData.candidates || [],
      decidedCandidateId: eventData.decidedCandidateId || ''
    };

    const result = await callGasApi(payload);
    if (!result.success) throw new Error(result.error || 'イベント作成に失敗しました');

    return result; // { success: true, eventId, editToken, createdAt }
  }

  /**
   * イベント取得 (GET)
   */
  async function getEvent(eventId) {
    if (!isCloudEnabled()) return null;

    const endpoint = getApiEndpoint();
    const url = `${endpoint}?action=getEvent&id=${encodeURIComponent(eventId)}&_t=${Date.now()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();
    if (!json.success) return null;
    return json.event;
  }

  /**
   * 出欠回答の保存 (Upsert)
   */
  async function submitResponse(eventId, responseData) {
    if (!isCloudEnabled()) {
      return { success: true, isLocal: true };
    }

    const payload = {
      action: 'submitResponse',
      eventId: eventId,
      respondentId: responseData.id,
      name: responseData.name,
      answers: responseData.answers || {},
      comment: responseData.comment || ''
    };

    const result = await callGasApi(payload);
    if (!result.success) throw new Error(result.error || '回答の送信に失敗しました');
    return result;
  }

  /**
   * イベント情報の編集・更新
   */
  async function updateEvent(eventId, eventData, editToken) {
    if (!isCloudEnabled()) {
      return { success: true, isLocal: true };
    }

    const payload = {
      action: 'updateEvent',
      eventId: eventId,
      editToken: editToken || '',
      title: eventData.title,
      description: eventData.description,
      members: eventData.members,
      rules: eventData.rules,
      decidedCandidateId: eventData.decidedCandidateId
    };

    const result = await callGasApi(payload);
    if (!result.success) throw new Error(result.error || 'イベントの更新に失敗しました');
    return result;
  }

  // ---------------------------------------------------------------------------
  // URL & ルーティング ヘルパー
  // ---------------------------------------------------------------------------

  /**
   * 現在のURLハッシュを解析
   * 返り値: { type: 'cloud', eventId: '...' } または { type: 'hash', raw: '...' } または null
   */
  function parseRoute() {
    const hash = window.location.hash || '';
    if (!hash) return null;

    // クラウド短縮URL: #/e/{id} または #e/{id}
    const cloudMatch = hash.match(/^#\/?e\/([a-zA-Z0-9_\-]+)/);
    if (cloudMatch && cloudMatch[1]) {
      return { type: 'cloud', eventId: cloudMatch[1] };
    }

    // ハッシュデータ埋め込み: #data=...
    const dataMatch = hash.match(/data=([^&]+)/);
    if (dataMatch && dataMatch[1]) {
      return { type: 'hash', raw: dataMatch[1] };
    }

    return null;
  }

  /**
   * 共有用URLの生成
   */
  function buildShareUrl(event) {
    if (!event) return window.location.href;
    const base = window.location.origin + window.location.pathname;

    if (isCloudEnabled()) {
      // 短縮URL (例: https://example.com/#/e/evt_abc123)
      return `${base}#/e/${event.id}`;
    } else {
      // LocalStorage / URLハッシュ埋め込み
      const jsonStr = JSON.stringify(event);
      const b64 = encodeURIComponent(btoa(unescape(encodeURIComponent(jsonStr))));
      return `${base}#data=${b64}`;
    }
  }

  // ---------------------------------------------------------------------------
  // 編集権限トークン (editToken) の LocalStorage 管理
  // ---------------------------------------------------------------------------
  const EDIT_TOKEN_PREFIX = 'tomoplan_edit_token_';

  function saveEditToken(eventId, token) {
    if (!eventId || !token) return;
    try {
      localStorage.setItem(EDIT_TOKEN_PREFIX + eventId, token);
    } catch (e) {}
  }

  function getEditToken(eventId) {
    if (!eventId) return null;
    try {
      return localStorage.getItem(EDIT_TOKEN_PREFIX + eventId);
    } catch (e) {
      return null;
    }
  }

  return {
    isCloudEnabled,
    getApiEndpoint,
    createEvent,
    getEvent,
    submitResponse,
    updateEvent,
    parseRoute,
    buildShareUrl,
    saveEditToken,
    getEditToken
  };
})();

if (typeof window !== 'undefined') {
  window.TomoApi = TomoApi;
}
