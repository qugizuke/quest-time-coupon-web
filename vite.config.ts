/**
 * @file Vite ビルド設定
 * @description React SPA の開発サーバー・本番ビルドを構成する。
 *   `adjustments/grade.json`（任意加減点定義）を public へコピーし、dist を出力する。
 *   `quests/daily.json` はモック API・テスト専用フィクスチャであり、本番経路は
 *   `GET dailyQuests`（`useDailyQuests`）に一本化したため public へコピーしない
 *   （Issue #33・静的 `public/quests/daily.json` 配信は廃止）。
 *   本番ホスティングの正は Firebase App Hosting（base は通常 `/`）。
 *   `GITHUB_PAGES=true` 時のみ旧 GitHub Pages 用の base を付与する。
 * @limitation API 接続にはビルド時環境変数 VITE_API_URL / VITE_API_KEY が必要
 *   （本番は apphosting.yaml、ローカルは .env で与える）
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cpSync, mkdirSync } from "node:fs";
import path, { resolve } from "node:path";

/** JSON 定義を public 配下へ同期するプラグイン */
function copyDefinitionsPlugin() {
  return {
    name: "copy-definitions",
    buildStart() {
      const definitions = [
        {
          src: resolve(__dirname, "adjustments/grade.json"),
          dest: resolve(__dirname, "public/adjustments/grade.json"),
        },
      ];
      for (const def of definitions) {
        mkdirSync(path.dirname(def.dest), { recursive: true });
        cpSync(def.src, def.dest);
      }
    },
  };
}

/** GitHub Actions ビルド時のみ repository Pages 用 base を付与する */
const isGitHubPages = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  base: isGitHubPages ? "/quest-time-coupon-web/" : "/",
  plugins: [react(), tailwindcss(), copyDefinitionsPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
  },
});
