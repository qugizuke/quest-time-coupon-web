# Quest Time Coupon — Source

小学4年生向け家庭用 Web アプリのソースコード。

## 設計ドキュメント

設計・要件は **docs リポジトリ** にあります（同じ Subgroup）。

- ローカル: `../docs/`
- GitLab: `qugizuke/projects/quest-time-coupon/docs`

## 初回セットアップ

```bash
npm install
cp .env.example .env   # VITE_MOCK_API=true で GAS なし開発可
npm run dev
```

- 開発 URL: http://localhost:5173
- モック API 無効化: `.env` で `VITE_MOCK_API=false` と GAS URL/キーを設定

## デプロイ

GitLab CI から GitLab Pages へデプロイ（`.gitlab-ci.yml`）。

- Pages URL: https://src-b67872.gitlab.io/
- 設定: プロジェクト → Settings → General → Pages → Everyone（公開）

## Cursor 初回プロンプト

```
../docs/requirements.md と ../docs/screen-design.md を読んで、
詳細設計と MVP 実装を始めてください。
```

## 関連リポジトリ

| リポジトリ | 役割 |
|-----------|------|
| [docs](../docs/) | 設計・要件 |
| [gas](../gas/) | GAS API・Spreadsheet 初期化 |
| 本リポジトリ（src） | **フロントのみ**（Pages デプロイ） |

## ディレクトリ

```
src/
├── public/
├── quests/        # クエスト定義 → ビルド時に public へコピー
├── src/           # React フロント
└── .gitlab-ci.yml
```

## 技術スタック

| 項目 | 選定 |
|------|------|
| ビルド | Vite 6 |
| 言語 | TypeScript 5 |
| UI | **React 19** + React Router 7 |
| スタイル | **Tailwind CSS 4** |
| データ取得 | TanStack Query 5 |
| ホスティング | GitLab Pages |
| API | Google Apps Script（実装は `../gas/`） |

詳細: `../docs/detail-design.md` §1  
GAS セットアップ: `../gas/README.md`
