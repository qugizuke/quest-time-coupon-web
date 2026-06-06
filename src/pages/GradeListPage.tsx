/**
 * @file GradeListPage
 * @description 保護者向け採点日一覧。
 */
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { gradeDatesQuery } from "@/api/queries";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { formatDateJa } from "@/lib/date";

const STATUS_LABEL = {
  ungraded: "未採点",
  graded: "採点済",
  unanswered: "未回答",
} as const;

/**
 * 採点日一覧の右側ラベルを返す
 * @param {object} item - 採点日1件
 * @returns {{ text: string; className: string }} 表示文言と色
 */
function gradeDateRightLabel(item: {
  status: keyof typeof STATUS_LABEL;
  ungradedCount: number;
  totalPoints: number | null;
}): { text: string; className: string } {
  if (item.status === "graded") {
    const points = item.totalPoints ?? 0;
    return {
      text: `${points >= 0 ? "+" : ""}${points}分`,
      className: points >= 0 ? "text-success" : "text-danger",
    };
  }
  if (item.status === "ungraded" && item.ungradedCount > 0) {
    return {
      text: `${STATUS_LABEL.ungraded}（${item.ungradedCount}）`,
      className: "font-medium text-primary",
    };
  }
  return {
    text: STATUS_LABEL[item.status],
    className: "text-sm font-medium text-muted",
  };
}

/**
 * 採点日一覧
 * @returns {JSX.Element} ページ
 */
export function GradeListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery(gradeDatesQuery);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <AppLayout>
        <p className="text-danger">{error instanceof Error ? error.message : "エラー"}</p>
      </AppLayout>
    );
  }

  const dates = data?.dates ?? [];

  return (
    <AppLayout>
      <h1 className="mb-4 text-app-lg font-bold">採点日一覧</h1>
      {dates.length === 0 ? (
        <p className="text-muted">
          まだ回答データがありません。子どもがクエストに回答すると、ここに採点対象の日付が表示されます。
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {dates.map((d) => {
            const clickable = d.status === "ungraded";
            const right = gradeDateRightLabel(d);
            return (
              <li key={d.date}>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && navigate(`/grade/${d.date}`)}
                  className={`flex w-full items-center justify-between rounded-default px-4 py-3 text-left shadow-sm ${
                    clickable
                      ? "bg-white hover:bg-primary/5"
                      : "cursor-default bg-gray-100 text-muted"
                  }`}
                >
                  <span>{formatDateJa(d.date)}</span>
                  <span className={`text-sm ${right.className}`}>{right.text}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Button className="mt-6" variant="secondary" fullWidth onClick={() => navigate("/")}>
        ホームへ
      </Button>
    </AppLayout>
  );
}
