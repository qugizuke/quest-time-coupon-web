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

  return (
    <AppLayout>
      <h1 className="mb-4 text-[length:var(--font-size-lg)] font-bold">採点日一覧</h1>
      <ul className="flex flex-col gap-2">
        {(data?.dates ?? []).map((d) => {
          const clickable = d.status === "ungraded";
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
                <span className="text-sm font-medium">{STATUS_LABEL[d.status]}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <Button className="mt-6" variant="secondary" fullWidth onClick={() => navigate("/")}>
        ホームへ
      </Button>
    </AppLayout>
  );
}
