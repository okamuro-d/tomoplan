# 🗓️ TomoPlan (トモプラン) - 友達との日程調整Webアプリ (v2)

友達とのご飯会、旅行、遊びの予定をサクッと決められる、スマホ・LINE特化＆完全無料の日程調整Webアプリケーションです。

---

## ✨ 主な特徴

1. **完全無料のクラウド同期（Google Apps Script ＋ スプレッドシート連携）**
   - URLが `https://.../#/e/{id}` という超短縮形式になり、LINEで崩れる心配がありません。
   - Google Apps Scriptを完全無料APIサーバー、スプレッドシートをDBとして使用（0円）。
   - **フォールバック安心設計**: 未設定時は自動でブラウザ単体（LocalStorage & URLハッシュ）で動作します。

2. **📸 集計結果の1枚画像化 ＆ LINE直接共有（html2canvas ＋ Web Share API）**
   - LINEのアルバムやノートにそのまま貼れる**4:5比率の専用レポートカード画像（PNG）**を生成。
   - スマホの対応ブラウザでは直接LINE共有シートが起動。画像のQRコードからWebを開いて再回答も可能。

3. **🍏 iPhone・Mac標準カレンダー（.ics）＆ Googleカレンダー連携**
   - RFC5545準拠の `.ics` ファイルを生成。iPhoneのSafariで開くと標準カレンダーアプリにそのまま登録可能。
   - 参加可能メンバーの一覧やイベントURLも自動でメモ欄に記載。

4. **👥 メンバー事前登録 ＆ 1タップ名前選択（表記揺れバグの完全防止）**
   - イベント作成時に参加予定メンバーをタグ形式で事前登録（カンマや空白区切りで一括追加可）。
   - 回答者は自分の名前を**1タップで選んで回答開始**。タイポや表記揺れを根本から防ぎます。
   - 予定外のゲスト向けに「✏️ その他の名前で回答」フォールバック枠も完備。

5. **📏 前提ルール ＆ 除外日程のリアルタイム無効化**
   - 「誰か1人でも✕なら除外」「特定の必須参加者が✕なら除外」を事前設定可能。
   - 条件から外れた日程は回答フォーム上でグレーアウト＆無効化（誤って✕にした本人は名前を選び直して自己復活可能）。

6. **⚡ クイック入力支援 ＆ 絞り込みフィルタ**
   - 「今月土日」「来月土日」「再来月土日」の一括追加ボタン。
   - 結果画面での「✕なし」「N人以上OK」「特定の人物が参加可能（AND条件）」リアルタイムフィルタ。

---

## 🚀 起動方法

### 方法1: ローカル開発サーバーで起動（推奨）
```powershell
cd C:\Users\okka0\.gemini\antigravity-ide\scratch\schedule-app
npx serve -l 5173 .
```
ブラウザで [http://localhost:5173](http://localhost:5173) にアクセスしてください。

### 方法2: ブラウザで直接開く
[index.html](file:///C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/index.html) をお好みのブラウザ（Google Chrome, Edgeなど）でダブルクリックして開くだけで即座に動作します。

---

## ☁️ Google Apps Script (GAS) バックエンドのセットアップ（3分）

完全無料で短縮URL（`#/e/{id}`）とスプレッドシート保存を有効化する手順は、以下のマニュアルをご覧ください：

👉 **[gas/README.md（詳しい設定手順書）](file:///C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/gas/README.md)**

1. [Google スプレッドシート](https://sheets.new) を新規作成
2. 「拡張機能」＞「Apps Script」に [`gas/Code.gs`](file:///C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/gas/Code.gs) を貼り付け
3. `setupSheets` を実行して「デプロイ」
4. 発行されたURLを [`config.js`](file:///C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/config.js) に貼るだけ！

---

## 📁 ファイル構成

- [index.html](file:///C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/index.html): メイン画面・モーダル・画像生成用オフスクリーンDOM
- [style.css](file:///C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/style.css): モダンCSS（デザインシステム、グラスモフィズム、シェアカード専用スタイル）
- [app.js](file:///C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/app.js): アプリ状態管理、日程計算、.ics生成、html2canvas画像化、ポーリング
- [api.js](file:///C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/api.js): GAS Web App API クライアント、短縮URLルーティング、トークン管理
- [config.js](file:///C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/config.js): GASエンドポイント設定（未設定時は自動フォールバック）
- [gas/Code.gs](file:///C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/gas/Code.gs): Google Apps Script バックエンドAPIコード
- [gas/README.md](file:///C:/Users/okka0/.gemini/antigravity-ide/scratch/schedule-app/gas/README.md): GAS＋スプレッドシートの完全無料セットアップガイド
- `test_phase1.js` / `test_phase1_5.js` / `test_phase2.js` / `test_phase3.js`: 自動テストスイート
