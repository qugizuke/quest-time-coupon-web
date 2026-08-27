/**
 * @file ParentManagementPage
 * @description 保護者向けポイント・チケット管理。
 *   日常の状況確認を行う保護者ホームから、実際の管理操作を分離する。
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { parentHomeQuery } from "@/api/queries";
import { PenaltyTicketConsumeSection } from "@/components/PenaltyTicketConsumeSection";
import { PenaltyTicketIssueSection } from "@/components/PenaltyTicketIssueSection";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { ParentPageFrame } from "@/components/layout/ParentPageFrame";
import { Button } from "@/components/ui/Button";

/** 保護者向けポイント・チケット管理画面 */
export function ParentManagementPage() {
  const navigate = useNavigate();
  const { data: parentHome, isLoading, error } = useQuery(parentHomeQuery);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !parentHome) {
    return (
      <ParentPageFrame>
        <p className="text-danger">
          {error instanceof Error ? error.message : "読み込みに失敗しました"}
        </p>
      </ParentPageFrame>
    );
  }

  return (
    <ParentPageFrame>
      <div className="mb-6 flex flex-col gap-2">
        <p className="text-sm text-muted">保護者モード</p>
        <h1 className="text-app-lg text-ink">ポイント・チケット管理</h1>
        <p className="text-sm text-muted">
          ポイントに関わるチケットの発行・消費を管理します。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2" data-testid="management-grid">
        <PenaltyTicketIssueSection
          balancePoints={parentHome.balancePoints}
          issuablePenaltyTicketCount={parentHome.issuablePenaltyTicketCount}
        />
        <PenaltyTicketConsumeSection
          penaltyTicketCount={parentHome.penaltyTicketCount}
        />

        {/*
          TODO: ポイント補填の専用UI・APIを設計してから有効化する。
          交換承認画面への代替遷移は機能名と一致しないため、現時点では表示しない。
        */}
      </div>

      <Button
        className="mt-6"
        fullWidth
        variant="secondary"
        onClick={() => navigate("/parent")}
      >
        保護者ホームへ
      </Button>
    </ParentPageFrame>
  );
}
