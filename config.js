/**
 * TomoPlan - 設定ファイル
 * 
 * Google Apps Script (GAS) のウェブアプリURLを設定することで、
 * 完全無料のクラウドデータベース（Googleスプレッドシート）と連携できます。
 * 
 * 未設定（空文字 ''）の場合は、自動的にブラウザ単体（LocalStorage & URLハッシュ）で動作します。
 * セットアップ手順は gas/README.md をご覧ください。
 */

const CONFIG = {
  // 例: 'https://script.google.com/macros/s/AKfycb.../exec'
  GAS_API_URL: ''
};

if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}
