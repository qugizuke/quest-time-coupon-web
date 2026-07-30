/**
 * @file ParentGuard
 * @description `/parent*` への未認証アクセスをパスワードモーダルでゲートする。
 *   認証前は子ルート（ページ本体）を描画しない（screen-design §5.1.1）。
 */
import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { ParentPasswordModal } from "@/components/ParentPasswordModal";
import { isParentAuthed } from "@/lib/parentAuth";

/**
 * 保護者ルートガード
 * @returns {JSX.Element} 子ルートまたはパスワードモーダルのみ
 */
export function ParentGuard() {
  const navigate = useNavigate();
  /** 認証成功後に再描画するためのカウンタ */
  const [authTick, setAuthTick] = useState(0);
  const authed = isParentAuthed();

  // authTick は isParentAuthed の再評価トリガ
  void authTick;

  if (!authed) {
    return (
      <div className="min-h-screen w-full bg-bg">
        <ParentPasswordModal
          open
          onSuccess={() => setAuthTick((value) => value + 1)}
          onDismiss={() => navigate("/", { replace: true })}
        />
      </div>
    );
  }

  return <Outlet />;
}
