/**
 * @file AppLayout
 * @description 共通レイアウト（子ども＝クリーム背景・保護者＝ブルーグレー切替可）。
 * 背景は viewport 全幅・全高の外側コンテナに付け、最大幅は内側コンテンツのみに適用する。
 */
import type { ReactNode } from "react";

/**
 * @typedef {object} AppLayoutProps
 * @property {ReactNode} children - ページ内容
 * @property {"kid" | "kid-vacation" | "parent"} [surface] - 背景面
 */
interface AppLayoutProps {
  /** @type {ReactNode} ページ内容 */
  children: ReactNode;
  /** @type {"kid" | "kid-vacation" | "parent"} 背景面 */
  surface?: "kid" | "kid-vacation" | "parent";
}

const surfaceClass = {
  kid: "bg-bg",
  "kid-vacation": "bg-bg-vacation",
  parent: "bg-bg-parent",
} as const;

/**
 * アプリ共通レイアウト
 * @param {AppLayoutProps} props - props
 * @returns {JSX.Element} レイアウト
 */
export function AppLayout({ children, surface = "kid" }: AppLayoutProps) {
  return (
    <div className={`min-h-screen w-full ${surfaceClass[surface]}`}>
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-8">
        {children}
      </main>
    </div>
  );
}
