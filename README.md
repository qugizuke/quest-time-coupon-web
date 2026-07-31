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
cp .env.example .env   # VITE_MOCK_API=true で API なし開発可
npm run dev
```

- 開発 URL: <http://localhost:5173>
- ローカル: `.env`（**gitignore 済み・絶対に commit しない**）に `VITE_API_URL` / `VITE_API_KEY` / `VITE_MOCK_API` を設定
- **本番（App Hosting）**: `apphosting.yaml` + Cloud Secret Manager（`.env` は使われない）
- **GitHub Actions secret は不要**（旧 Pages 用。本番経路ではない）

## API 接続（Cloud Functions）

バックエンドは **Firebase Cloud Functions v2**（`asia-northeast1`）。API ベース URL は **`VITE_API_URL` のみ**（旧 `VITE_GAS_URL` フォールバックは廃止）。

| 環境変数 | 役割 |
| --- | --- |
| `VITE_API_URL` | `api` 関数のベース URL（末尾スラッシュなし）。例: `https://asia-northeast1-quest-time-coupon-95106.cloudfunctions.net/api` |
| `VITE_API_KEY` | 共有キー。正本は Secret Manager（App Hosting の `VITE_API_KEY` / Functions の `API_SECRET` と同値） |
| `VITE_MOCK_API` | `"true"` のときのみモック。**未設定・その他の値はすべてモックなし** |

| 呼び出し | URL |
| --- | --- |
| action（通常の API） | `${VITE_API_URL}?action=home&date=...` |
| 疎通確認 | `${VITE_API_URL}/ping` |

- 認証は **ヘッダー `X-Api-Key`**（クエリ `?key=` は Cloud Logging に残るため使わない）
- POST は `Content-Type: application/json`（Functions は CORS プリフライトに対応）
- `VITE_*` はビルド時にバンドルへ埋め込まれ、**ブラウザから参照可能**。真に秘匿すべき値は置かない
- ローカル本接続時は Secret Manager の値を `.env` の `VITE_API_KEY` に入れる（平文を PR / commit / チャットに出さない）

## デプロイ

### 本番（正）: Firebase App Hosting

`main` へのマージで App Hosting が自動デプロイする（初期設定は CEO 済み。再設定不要）。

- 本番 URL / カスタムドメイン: docs の [firebase-setup.md](../../docs/firebase-setup.md) §3.4
- Functions の CORS 許可 Origin も同じ Origin に合わせること

#### 配信の仕組み（superstatic）

App Hosting は Cloud Run 上でアプリを起動するため、静的ファイルを置くだけでは配信されない（`start` が無いとロールアウトが成立しない）。そのため **`superstatic` を dependencies に入れ**、`npm start` で `dist/` を配信する。

| ファイル | 役割 |
| --- | --- |
| `apphosting.yaml` | runConfig（cpu/memory/instances）とビルド時環境変数 |
| `superstatic.json` | SPA フォールバック（全ルート → `/index.html`）と Cache-Control |
| `package.json` の `start` | `superstatic dist --port $PORT --host 0.0.0.0` |

`superstatic.json` の `headers` は **後に書いたルールが勝つ**。`**`（`no-cache`）を先に、
ハッシュ付き `/assets/**`（`immutable`）を後に置くこと（逆にすると assets が毎回再取得になる）。

本番と同じ配信をローカルで確認する:

```bash
npm run build
PORT=8080 npm start   # http://localhost:8080
```

> **Classic Hosting（`firebase hosting`）は使わない。** `firebase.json` / `.firebaserc` の
> hosting 設定は追加しないこと（App Hosting のビルドパイプラインと二重管理になる）。

#### `VITE_API_KEY`（正本: Secret Manager）

本番の正本は **Cloud Secret Manager**（project `quest-time-coupon-95106`）。`apphosting.yaml` は平文を書かず `secret: VITE_API_KEY` で参照する（設定済み）。

| 場所 | 扱い |
| --- | --- |
| 本番（App Hosting） | Secret Manager → `apphosting.yaml`（ビルド時埋め込み） |
| ローカル | `.env` の `VITE_API_KEY`（gitignore。Secret Manager と同値） |
| GitHub Actions secret | **不要**（旧 Pages 用。設定しない・残っていれば削除してよい） |

初回登録・再設定が必要なときだけ:

```bash
npx -y firebase-tools@latest apphosting:secrets:set VITE_API_KEY \
  --project quest-time-coupon-95106
npx -y firebase-tools@latest apphosting:secrets:grantaccess VITE_API_KEY \
  --backend quest-time-coupon-web --project quest-time-coupon-95106
```

Secret 未設定のままビルドすると配信はできても API は `UNAUTHORIZED`（401）になる。

### 旧経路: GitHub Pages（廃止）

GitHub Pages（`.github/workflows/pages.yml`）は **廃止済み**（ファイル削除）。本番は Firebase App Hosting のみ。旧 Pages 用の GitHub secret（`VITE_API_KEY` 等）は不要。

旧 Pages URL（参考・非運用）: <https://qugizuke.github.io/quest-time-coupon-web/>

本番相当のローカル確認（ルート base）:

```bash
npm run build && npx vite preview
```

## 関連リポジトリ

| リポジトリ | 役割 |
| --- | --- |
| [quest-time-coupon](https://github.com/qugizuke/quest-time-coupon) | 設計・要件 |
| 本リポジトリ | **フロントのみ**（Firebase App Hosting） |
| [quest-time-coupon-firebase-functions](https://github.com/qugizuke/quest-time-coupon-firebase-functions) | Cloud Functions + Firestore（API 正） |

## ディレクトリ

```text
├── .github/workflows/
├── adjustments/       # 保護者裁量の加減点定義 → ビルド時に public へコピー
├── apphosting.yaml    # Firebase App Hosting 設定（runConfig / ビルド時環境変数）
├── public/
├── quests/            # クエスト定義 → ビルド時に public へコピー
├── src/               # React フロント
└── superstatic.json   # dist 配信設定（SPA フォールバック）
```

## 定義ファイルの同期

- `quests/daily.json` はビルド時に `public/quests/daily.json` へ自動コピーされます。
- `adjustments/grade.json` はビルド時に `public/adjustments/grade.json` へ自動コピーされます。
- `adjustments/grade.json` の項目を増減した場合は、Functions リポジトリ側の加減点定義も同じ内容に同期してください。Web だけ更新すると、API の検証で未知の `code` として拒否されます。

## 技術スタック

| 項目 | 選定 |
| --- | --- |
| ビルド | Vite 6 |
| 言語 | TypeScript 5 |
| UI | **React 19** + React Router 7 |
| スタイル | **Tailwind CSS 4** |
| データ取得 | TanStack Query 5 |
| ホスティング | **Firebase App Hosting** + superstatic（GitHub Pages は廃止） |
| API | **Firebase Cloud Functions v2**（旧: Google Apps Script） |
