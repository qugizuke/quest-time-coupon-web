/**
 * @file ParentPageFrame
 * @description 保護者画面共通枠（ヘッダー＋レイアウト）。終了で認証破棄→`/`。
 */
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppLayout } from "@/components/layout/AppLayout";
import { clearParentAuthed } from "@/lib/parentAuth";

/**
 * @typedef {object} ParentPageFrameProps
 * @property {ReactNode} children - ページ内容
 */
interface ParentPageFrameProps {
  /** @type {ReactNode} ページ内容 */
  children: ReactNode;
}

/**
 * 保護者ページ枠
 * @param {ParentPageFrameProps} props - props
 * @returns {JSX.Element} 枠
 */
export function ParentPageFrame({ children }: ParentPageFrameProps) {
  const navigate = useNavigate();

  /**
   * 保護者モードを終了する
   * @returns {void}
   */
  function handleExitParentMode() {
    clearParentAuthed();
    navigate("/", { replace: true });
  }

  return (
    <AppLayout surface="parent">
      <div className="-mx-4 mb-4 sm:-mx-8">
        <AppHeader
          mode="parent"
          showHome
          onHome={() => navigate("/parent")}
          onExitParentMode={handleExitParentMode}
        />
      </div>
      {children}
    </AppLayout>
  );
}
