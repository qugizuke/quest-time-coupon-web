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
- [ ] 動作確認の観点を PR 本文に書いた
- [ ] （本番反映時）`develop` → `main` のマージは検証完了後のみ

## デプロイについて

- **正**: Firebase App Hosting（`main`）
- **旧**: `.github/workflows/pages.yml`（GitHub Pages）。App Hosting と二重になるため、
  無効化は CEO 判断。詳細は [README.md](./README.md) の「デプロイ」節
