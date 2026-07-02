# Quest Time Coupon — Web

小学4年生向け家庭用 Web アプリのフロントエンド。

## 設計ドキュメント

設計・要件は **quest-time-coupon** リポジトリの `docs/` にあります。

- ローカル（monorepo）: `../../docs/`
- GitHub: [quest-time-coupon](https://github.com/qugizuke/quest-time-coupon)

## 初回セットアップ

```bash
npm install
cp .env.example .env   # VITE_MOCK_API=true で GAS なし開発可
npm run dev
```

- 開発 URL: http://localhost:5173
- ローカル: `.env` に `VITE_GAS_URL` / `VITE_API_KEY` / `VITE_MOCK_API` を設定
- **GitHub Pages**: `.env` は使われない。Actions Secrets に同じ `VITE_*` を登録して再ビルドすること

## デプロイ

`main` への push または手動実行で GitHub Actions から GitHub Pages へデプロイ（`.github/workflows/pages.yml`）。

- Pages URL: https://qugizuke.github.io/quest-time-coupon-web/
- 設定: Settings → Pages → Build and deployment → Source: **GitHub Actions**
- Secrets: Settings → Secrets and variables → Actions に `VITE_GAS_URL` / `VITE_API_KEY`

本番相当のローカル確認:

```bash
GITHUB_PAGES=true npm run build && npx vite preview --base /quest-time-coupon-web/
```

## 関連リポジトリ

| リポジトリ | 役割 |
|-----------|------|
| [quest-time-coupon](https://github.com/qugizuke/quest-time-coupon) | 設計・要件・GAS |
| 本リポジトリ | **フロントのみ**（Pages デプロイ） |

## ディレクトリ

```
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
| ホスティング | GitHub Pages |
| API | Google Apps Script |
