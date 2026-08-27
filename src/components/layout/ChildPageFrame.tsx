/**
 * @file ChildPageFrame
 * @description 子ども画面共通枠（ヘッダー＋保護者モード入口モーダル）。
 *   screen-design §5 の「全子ども画面」導線を提供する。
 *   長期休みモード中はライトブルー背景＋ヘッダーバッジ（Issue #16）。
 */
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { homeQuery } from "@/api/queries";
import { ParentPasswordModal } from "@/components/ParentPasswordModal";
import { AppHeader } from "@/components/layout/AppHeader";
import { AppLayout } from "@/components/layout/AppLayout";

/**
 * @typedef {object} ChildPageFrameProps
 * @property {ReactNode} children - ページ内容
 * @property {boolean} [showHome] - ヘッダーのホームボタン表示（ホーム以外で true）
 * @property {boolean} [vacationMode] - 明示指定（テスト用）。未指定時は home API
 */
interface ChildPageFrameProps {
  /** @type {ReactNode} ページ内容 */
  children: ReactNode;
  /** @type {boolean} ヘッダーのホームボタン表示 */
  showHome?: boolean;
  /** @type {boolean} 長期休みモード（未指定時は home.isVacationMode） */
  vacationMode?: boolean;
}

/**
 * 子どもページ枠
 * @param {ChildPageFrameProps} props - props
 * @returns {JSX.Element} 枠
 */
export function ChildPageFrame({
  children,
  showHome = true,
  vacationMode: vacationModeProp,
}: ChildPageFrameProps) {
  const navigate = useNavigate();
  /** 保護者パスワードモーダルの開閉 */
  const [parentPasswordOpen, setParentPasswordOpen] = useState(false);
  const { data: homeData } = useQuery({
    ...homeQuery,
    enabled: vacationModeProp === undefined,
  });
  const vacationMode = vacationModeProp ?? homeData?.isVacationMode ?? false;

  return (
    <AppLayout surface={vacationMode ? "kid-vacation" : "kid"}>
      <div className="relative -mx-4 -mt-6 mb-6 w-auto sm:-mx-8">
        <AppHeader
          mode="kid"
          showHome={showHome}
          vacationMode={vacationMode}
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
