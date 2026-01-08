# 縦書き小説エディタ (静的サイト)

ビルド不要・オフライン対応の小説用縦書きWebエディタです。HTML/CSS/Vanilla JSのみで実装しています。

## 使い方
- `index.html` をブラウザで開き、作品を作成してください。
- 作品カードの「開く」で `editor.html` に移動します。
- 作品データは IndexedDB に保存され、利用できない環境では LocalStorage にフォールバックします。

## 実装した仕様（決めた仕様）
- **データ保存**: IndexedDB (`tategakiNovelDB`) を主に使用し、失敗時は LocalStorage へ自動フォールバック。
- **章本文の保存形式**: ルビ/縦中横/傍点を保持するため HTML を保存。
- **縦書き段組の列順**: `writing-mode: vertical-rl` による右端開始の列順を採用し、本文の字送りは上→下になるよう `direction: ltr` で統一。
- **本文Bidiの安定化**: 本文直下の要素に `direction: ltr` を適用。
- **段落モード**: 作品設定の `paragraphMode` を `indent / none / spaced` で切替。
- **検索/置換**: DOMテキストノードを走査して置換し、タグ構造 (ruby/span) を破壊しない。
- **Ctrl+S**: 作品HTML書き出し。
- **Ctrl+P**: 印刷。
- **Ctrl+Alt+R**: ルビ挿入。
- **Ctrl+Alt+T**: 縦中横。
- **数字の自動TCY**: 設定ON時に入力後のぼかし・保存時に適用（2〜6桁）。

## ファイル構成
- `index.html`: 作品一覧
- `editor.html`: エディタ本体
- `styles.css`: UIスタイル
- `app-shared.js`: IndexedDB/LocalStorage + 共有ユーティリティ
- `app-home.js`: ホーム画面ロジック
- `app-editor.js`: エディタロジック
- `sw.js`: Service Worker
- `manifest.webmanifest`: PWAマニフェスト
- `icon.svg`: アイコン

## メモ
- ローカルのみで動作し、外部通信は行いません。
- HTML書き出しは単体で閲覧できる1ファイルとして生成されます。
