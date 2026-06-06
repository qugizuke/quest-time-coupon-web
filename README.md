# Quest Time Coupon — Source

小学4年生向け家庭用 Web アプリのソースコード。

## 設計ドキュメント

設計・要件は **docs リポジトリ** にあります（同じ Subgroup）。

- ローカル: `../docs/`
- GitLab: `qugizuke/projects/quest-time-coupon/docs`

## 初回セットアップ

```bash
# 詳細設計後
npm install
npm run dev
```

## デプロイ

GitLab CI から GitLab Pages へデプロイ（`.gitlab-ci.yml`）。

## Cursor 初回プロンプト

```
../docs/requirements.md と ../docs/screen-design.md を読んで、
詳細設計と MVP 実装を始めてください。
```

## ディレクトリ（予定）

```
src/
├── public/
├── src/           # フロントアプリ
├── quests/        # クエスト定義（コード管理）
├── gas/           # Google Apps Script
└── .gitlab-ci.yml
```

## 技術スタック（案）

| 項目 | 選定 |
|------|------|
| ビルド | Vite |
| 言語 | TypeScript |
| ホスティング | GitLab Pages |
| API | Google Apps Script |

※ フェーズ1詳細設計で確定
