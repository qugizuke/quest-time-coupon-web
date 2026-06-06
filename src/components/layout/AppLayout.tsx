/**
 * @file AppLayout
 * @description 共通レイアウト（最大幅・余白）。
 */
import type { ReactNode } from "react";

interface AppLayoutProps {
  /** @type {ReactNode} ページ内容 */
  children: ReactNode;
}

/**
 * アプリ共通レイアウト
 * @param {AppLayoutProps} props - props
 * @returns {JSX.Element} レイアウト
 */
export function AppLayout({ children }: AppLayoutProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col px-4 py-6">
      {children}
    </main>
  );
}
