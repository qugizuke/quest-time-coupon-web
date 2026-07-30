/**
 * @file ParentHomePage
 * @description 保護者ホーム骨格（本 UI は後続 Issue D）。
 */
import { useNavigate } from "react-router-dom";
import { ParentPageFrame } from "@/components/layout/ParentPageFrame";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * 保護者ホーム
 * @returns {JSX.Element} ページ
 */
export function ParentHomePage() {
  const navigate = useNavigate();

  return (
    <ParentPageFrame>
      <h1 className="mb-4 text-app-lg font-bold text-ink">保護者ホーム</h1>
      <Card className="mb-4">
        <p className="text-muted">
          運用の入口です。採点・設定の本 UI は後続 Issue で実装します。
        </p>
      </Card>
      <div className="flex flex-col gap-3">
        <Button fullWidth onClick={() => navigate("/parent/grades")}>
          採点をはじめる
        </Button>
        <Button
          fullWidth
          variant="secondary"
          onClick={() => navigate("/parent/settings")}
        >
          設定
        </Button>
      </div>
    </ParentPageFrame>
  );
}
