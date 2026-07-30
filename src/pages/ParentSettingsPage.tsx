/**
 * @file ParentSettingsPage
 * @description 保護者設定骨格（長期休み・免除・就寝変更の本 UI は後続 Issue）。
 */
import { useNavigate } from "react-router-dom";
import { ParentPageFrame } from "@/components/layout/ParentPageFrame";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

/**
 * 保護者設定
 * @returns {JSX.Element} ページ
 */
export function ParentSettingsPage() {
  const navigate = useNavigate();

  return (
    <ParentPageFrame>
      <h1 className="mb-4 text-app-lg font-bold text-ink">設定</h1>
      <Card className="mb-4">
        <p className="text-muted">
          長期休み・クエスト免除・就寝変更などの設定画面です（プレースホルダ）。
        </p>
      </Card>
      <Button
        fullWidth
        variant="secondary"
        onClick={() => navigate("/parent")}
      >
        保護者ホームへ
      </Button>
    </ParentPageFrame>
  );
}
