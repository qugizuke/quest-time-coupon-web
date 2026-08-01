# Contributing — quest-time-coupon-web

## ブランチ運用

| 項目 | ルール |
| --- | --- |
| default branch | **`develop`** |
| 作業ブランチの起点 | **必ず `develop`**（`main` から切らない） |
| Pull Request の base | **`develop`** |
| 本番反映 | `develop` で動作確認したあと **`main` へマージ** |
| 自動デプロイ | **`main` マージ → Firebase App Hosting**（設定済み） |

```text
feature/*  ──PR──►  develop  ──検証──►  main  ──自動──►  App Hosting
```

## PR チェックリスト

- [ ] base が `develop` である
- [ ] `npm test` / 型チェックが通る
- [ ] `npm run build` → `PORT=8080 npm start` で本番相当の配信を確認した
- [ ] 動作確認の観点を PR 本文に書いた
- [ ] （本番反映時）`develop` → `main` のマージは検証完了後のみ

## デプロイについて

- **正**: Firebase App Hosting（`main` マージで自動ロールアウト）
- 配信は `npm start`（superstatic が `dist/` を SPA フォールバック付きで配信）。
  `start` が壊れるとロールアウトが成立しないため、`superstatic` は **dependencies** に置く
- **Classic Hosting は不採用**。`firebase.json` / `.firebaserc` の hosting 設定を追加しない
- **旧 GitHub Pages**: 本番アプリは配信しない。`redirect/` の転送 HTML のみ `redirect-pages.yml` で配信。詳細は [README.md](./README.md) の「デプロイ」節

## API 接続

- バックエンドは Cloud Functions v2。環境変数の正は **`VITE_API_URL`**
  （`VITE_GAS_URL` は移行期のフォールバックのみ。新規コードで参照しない）
- 認証はヘッダー `X-Api-Key`。クエリ `?key=` は使わない（ログに残るため）
