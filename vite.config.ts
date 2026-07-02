/**
 * @file Vite ビルド設定
 * @description React SPA の開発サーバー・本番ビルドを構成する。
 *   JSON 定義を public へコピーし、GitHub Pages 向けに dist を出力する。
 * @limitation GAS URL はビルド時環境変数 VITE_GAS_URL / VITE_API_KEY が必要
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
          src: resolve(__dirname, "quests/daily.json"),
          dest: resolve(__dirname, "public/quests/daily.json"),
        },
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
