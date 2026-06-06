/**
 * @file Vite ビルド設定
 * @description React SPA の開発サーバー・本番ビルドを構成する。
 *   quests/daily.json を public へコピーし、GitLab Pages 向けに dist を出力する。
 * @limitation GAS URL はビルド時環境変数 VITE_GAS_URL / VITE_API_KEY が必要
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cpSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import path from "node:path";

/** quests 定義を public 配下へ同期するプラグイン */
function copyQuestsPlugin() {
  return {
    name: "copy-quests",
    buildStart() {
      const destDir = resolve(__dirname, "public/quests");
      mkdirSync(destDir, { recursive: true });
      cpSync(
        resolve(__dirname, "quests/daily.json"),
        resolve(destDir, "daily.json"),
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), copyQuestsPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
  },
});
