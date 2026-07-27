# Quest Time Coupon — Web

小学4年生向け家庭用 Web アプリのフロントエンド。

## 設計ドキュメント

設計・要件は **quest-time-coupon** リポジトリの `docs/` にあります。

- ローカル（monorepo）: `../../docs/`
- GitHub: [quest-time-coupon](https://github.com/qugizuke/quest-time-coupon)

## ブランチ運用（必須）

| 項目 | 内容 |
| --- | --- |
| default branch | **`develop`** |
| 作業ブランチ | **`develop` 起点**で作成 |
| PR 先 | **`develop`** |
| 本番反映 | 動作確認完了後に **`main` へマージ** |
| 本番デプロイ | **`main` マージ後、Firebase App Hosting が自動デプロイ**（CEO 設定済み） |

詳細は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照。

## 初回セットアップ

```bash
npm install
cp .env.example .env   # VITE_MOCK_API=true で GAS なし開発可
npm run dev
```

- 開発 URL: http://localhost:5173
- ローカル: `.env` に `VITE_GAS_URL` / `VITE_API_KEY` / `VITE_MOCK_API` を設定
- **本番（App Hosting）**: ビルド時環境変数は App Hosting / CI 側で設定する（`.env` は使われない）

## デプロイ

### 本番（正）: Firebase App Hosting

`main` へのマージで App Hosting が自動デプロイする（初期設定は CEO 済み。再設定不要）。

- 本番 URL / カスタムドメイン: docs の [firebase-setup.md](../../docs/firebase-setup.md) §3.4（CEO 記入欄）
- Functions の CORS 許可 Origin も同じ Origin に合わせること

### 旧経路: GitHub Pages（二重デプロイ注意）

`.github/workflows/pages.yml` は過去の GitHub Pages デプロイ用。**App Hosting と二重になる**。

| 方針 | 内容 |
| --- | --- |
| 現状 | workflow はリポジトリに残存（削除していない） |
| 推奨 | App Hosting のみにする場合、`pages.yml` を無効化（削除 or `on:` をコメントアウト） |
| 注意 | 無効化は本番 URL・ブックマーク影響の確認後に CEO 判断で実施。エージェントは勝手に削除しない |

旧 Pages URL（参考）: https://qugizuke.github.io/quest-time-coupon-web/

本番相当のローカル確認（ルート base）:

```bash
npm run build && npx vite preview
```

（旧 Pages 向けに `GITHUB_PAGES=true` で base 付きビルドも可能だが、App Hosting 本番では通常 `base: "/"`）

## 関連リポジトリ

| リポジトリ | 役割 |
|-----------|------|
| [quest-time-coupon](https://github.com/qugizuke/quest-time-coupon) | 設計・要件 |
| 本リポジトリ | **フロントのみ**（Firebase App Hosting） |
| `quest-time-coupon-functions`（新規） | Cloud Functions + Firestore |

## ディレクトリ

```text
├── .github/workflows/
├── adjustments/  # 保護者裁量の加減点定義 → ビルド時に public へコピー
├── public/
├── quests/        # クエスト定義 → ビルド時に public へコピー
└── src/           # React フロント
```

## 定義ファイルの同期

- `quests/daily.json` はビルド時に `public/quests/daily.json` へ自動コピーされます。
- `adjustments/grade.json` はビルド時に `public/adjustments/grade.json` へ自動コピーされます。
- `adjustments/grade.json` の項目を増減した場合は、GAS リポジトリ側の `src/scoring/adjustments.json` も同じ内容に同期してください。Web だけ更新すると、GAS API の検証で未知の `code` として拒否されます。

## 技術スタック

| 項目 | 選定 |
|------|------|
| ビルド | Vite 6 |
| 言語 | TypeScript 5 |
| UI | **React 19** + React Router 7 |
| スタイル | **Tailwind CSS 4** |
| データ取得 | TanStack Query 5 |
| ホスティング | **Firebase App Hosting**（旧: GitHub Pages） |
| API | Google Apps Script（移行中: Cloud Functions） |
