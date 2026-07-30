/**
 * @file ChildPageFrame
 * @description 子ども画面共通枠（ヘッダー＋保護者モード入口モーダル）。
 *   screen-design §5 の「全子ども画面」導線を提供する。
 */
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ParentPasswordModal } from "@/components/ParentPasswordModal";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppLayout } from "@/components/layout/AppLayout";

/**
 * @typedef {object} ChildPageFrameProps
 * @property {ReactNode} children - ページ内容
 * @property {boolean} [showHome] - ヘッダーのホームボタン表示（ホーム以外で true）
 */
interface ChildPageFrameProps {
  /** @type {ReactNode} ページ内容 */
  children: ReactNode;
  /** @type {boolean} ヘッダーのホームボタン表示 */
  showHome?: boolean;
}

/**
 * 子どもページ枠
 * @param {ChildPageFrameProps} props - props
 * @returns {JSX.Element} 枠
 */
export function ChildPageFrame({
  children,
  showHome = true,
}: ChildPageFrameProps) {
  const navigate = useNavigate();
  /** 保護者パスワードモーダルの開閉 */
  const [parentPasswordOpen, setParentPasswordOpen] = useState(false);

  return (
    <AppLayout>
      <div className="-mx-4 mb-4 sm:-mx-8">
        <AppHeader
          mode="kid"
          showHome={showHome}
          onHome={() => navigate("/")}
          onParentMode={() => setParentPasswordOpen(true)}
        />
      </div>
      {children}
      <ParentPasswordModal
        open={parentPasswordOpen}
        onSuccess={() => {
          setParentPasswordOpen(false);
          navigate("/parent");
        }}
        onDismiss={() => setParentPasswordOpen(false)}
      />
    </AppLayout>
  );
}
