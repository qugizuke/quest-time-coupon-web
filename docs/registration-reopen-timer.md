# 登録受付再開: タイマー設定（仕様変更）

> 正本は兄弟リポジトリ docs（`requirements.md` / `screen-design.md` /
> `api-tobe-f-contract.md`）へ同期する。本ファイルは web 側の実装メモ。

## 概要

保護者ホームの「登録受付を再開」は、終了**時刻**選択から「いまから N 分」の**タイマー**選択へ変更する。

## UI（screen-design / parent-home）

| 項目 | 内容 |
| --- | --- |
| 画面 | 保護者ホーム `/parent` |
| セクション | 登録受付を再開 |
| 説明文 | 当日1回のみ。いまからの時間を選んで子どもが登録できるようにします。 |
| 入力 | セレクトボックス「再開する時間」 |
| 候補 | `30分` / `1時間` / `1時間30分` / `2時間` |
| 初期選択 | `1時間` |
| 確定 | 「再開する」で POST |

## ルール（requirements）

1. 設定可能時間は **30分刻み・最大2時間**（30 / 60 / 90 / 120 分）。
2. `endsAt` は **現在時刻（JST）＋選択分数** で算出する。
3. **日付またぎを許容**する（例: 23:00 に 90分 → 翌日 00:30）。
4. 当日1回のみ・免除日不可・回答済み不可など既存の再開制約は維持する。

## API（api-tobe-f-contract §3.8）

- エンドポイント・payload 形は変更しない。
- `POST registrationReopen`
  - `date`: 当日 `YYYY-MM-DD`
  - `endsAt`: `YYYY-MM-DDTHH:mm:ss+09:00`（タイマーから算出）
- Web の入力 UI のみ変更。サーバが時刻スロット列挙を要求している場合は、その制約を緩和し「いま＋分数」を受け付けること。

## docs 同期チェックリスト

正本リポジトリ（`quest-time-coupon` / docs）で次を更新する。

- [ ] `requirements.md` … 再開 UI をタイマー記述へ
- [ ] `screen-design.md` … parent-home の終了時刻セレクト → 再開する時間
- [ ] `api-tobe-f-contract.md` §3.8 … endsAt が「いま＋分数」由来であることの注記（必要なら）
- [ ] `tobe-ui-wireframes.md`（あれば）… ラベル更新
