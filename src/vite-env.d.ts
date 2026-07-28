/// <reference types="vite/client" />

/**
 * ビルド時に埋め込まれる環境変数の型
 * @property {string} VITE_API_URL - Cloud Functions `api` 関数のベース URL（末尾スラッシュなし）
 * @property {string} VITE_API_KEY - API 共有キー（Functions の `API_SECRET` と同値）
 * @property {string} VITE_MOCK_API - `"true"` のときのみモック API を使う
 */
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_API_KEY: string;
  readonly VITE_MOCK_API: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
