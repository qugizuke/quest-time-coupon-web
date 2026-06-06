/**
 * @file HomePage
 * @description 子ども向けホーム。残高・状態・各画面への導線。
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { homeQuery } from "@/api/queries";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Banner } from "@/components/ui/Banner";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const STATUS_LABEL = {
  unanswered: "きょうはまだ お答えしていません",
  answered_ungraded: "お答え済み・採点まち",
  pending_ack: "けっかの かくにんが ひつようです",
  completed: "きょうは ぜんぶ おわり！",
} as const;

/**
 * ホーム画面
 * @returns {JSX.Element} ページ
 */
export function HomePage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery(homeQuery);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error || !data) {
    return (
      <AppLayout>
        <p className="text-danger">
          エラー: {error instanceof Error ? error.message : "不明"}
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-1 flex-col gap-6">
        <Card className="flex min-h-[40vh] flex-col items-center justify-center text-center">
          <p className="text-lg text-muted">のこり じかん</p>
          <p className="text-[length:var(--font-size-xl)] font-bold text-primary">
            {data.displayBalance}
            <span className="ml-2 text-2xl">ふん</span>
          </p>
          <p className="mt-4 text-base">{STATUS_LABEL[data.todayStatus]}</p>
        </Card>

        {data.unacknowledgedCount > 0 && (
          <Banner onClick={() => navigate("/results")}>
            採点けっかが {data.unacknowledgedCount} にち まっています。タップして
            かくにんしてね
          </Banner>
        )}

        <div className="flex flex-col gap-3">
          {data.questAction === "start" && (
            <Button fullWidth onClick={() => navigate("/quest")}>
              クエスト開始
            </Button>
          )}
          {data.questAction === "retry" && (
            <Button fullWidth variant="secondary" onClick={() => navigate("/quest")}>
              やり直す
            </Button>
          )}
          <Button fullWidth variant="secondary" onClick={() => navigate("/results")}>
            採点けっか
          </Button>
          <Button fullWidth variant="secondary" onClick={() => navigate("/timer")}>
            タイマー
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
