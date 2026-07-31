/**
 * @file GradeListPage
 * @description 保護者採点日一覧（月曜始まり週ナビ）。status / isExempt は gradeDates API を正とする。
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { gradeDatesQuery } from "@/api/queries";
import { ParentPageFrame } from "@/components/layout/ParentPageFrame";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/StatusBadge";
import { formatDateJa, todayLocal } from "@/lib/date";
import {
  formatWeekLabel,
  getMondayWithOffset,
  getWeekDates,
} from "@/lib/week";

/** 一覧ステータス */
type GradeListStatus = "ungraded" | "graded" | "unanswered" | "exempt";

const STATUS_LABEL: Record<GradeListStatus, string> = {
  ungraded: "未採点",
  graded: "採点済",
  unanswered: "未回答",
  exempt: "免除",
};

/**
 * ステータスの色を返す
 * @param {GradeListStatus} status - ステータス
 * @returns {StatusBadgeTone} トーン
 */
function statusTone(status: GradeListStatus): StatusBadgeTone {
  if (status === "ungraded") return "warning";
  if (status === "graded") return "success";
  if (status === "exempt") return "info";
  return "muted";
}

/**
 * 採点日一覧
 * @returns {JSX.Element} ページ
 */
export function GradeListPage() {
  const navigate = useNavigate();
  const today = todayLocal();
  const [weekOffset, setWeekOffset] = useState(0);
  const { data, isLoading, error } = useQuery(gradeDatesQuery);

  const monday = useMemo(
    () => getMondayWithOffset(today, weekOffset),
    [today, weekOffset],
  );
  const weekDates = useMemo(() => getWeekDates(monday), [monday]);

  const byDate = useMemo(() => {
    const map = new Map<
      string,
      {
        status: GradeListStatus;
        ungradedCount: number;
        totalPoints: number | null;
      }
    >();
    for (const item of data?.dates ?? []) {
      // gradeDates API を正とする（localStorage の免除は参照しない）
      const status: GradeListStatus =
        item.isExempt || item.status === "exempt" ? "exempt" : item.status;
      map.set(item.date, {
        status,
        ungradedCount: item.ungradedCount,
        totalPoints: item.totalPoints,
      });
    }
    return map;
  }, [data]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <ParentPageFrame>
        <p className="text-danger">
          {error instanceof Error ? error.message : "エラー"}
        </p>
      </ParentPageFrame>
    );
  }

  return (
    <ParentPageFrame>
      <h1 className="mb-4 text-app-lg font-bold text-ink">採点日一覧</h1>

      <div className="mb-4 flex items-center justify-between gap-2">
        <Button
          variant="secondary"
          className="px-3 text-base"
          onClick={() => setWeekOffset((v) => v - 1)}
        >
          ← 前週
        </Button>
        <p className="text-center text-sm font-medium text-ink">
          {formatWeekLabel(monday)}
        </p>
        <Button
          variant="secondary"
          className="px-3 text-base"
          onClick={() => setWeekOffset((v) => v + 1)}
        >
          翌週 →
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {weekDates.map((date) => {
          const api = byDate.get(date);
          const status: GradeListStatus = api?.status ?? "unanswered";
          const clickable = status === "ungraded" || status === "graded";
          const points = api?.totalPoints;
          const rightLabel =
            status === "graded" && points != null
              ? `${points >= 0 ? "+" : ""}${points}分`
              : status === "ungraded" && (api?.ungradedCount ?? 0) > 0
                ? `${STATUS_LABEL.ungraded}`
                : STATUS_LABEL[status];

          return (
            <li key={date}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => {
                  if (clickable) navigate(`/parent/grades/${date}`);
                }}
                className={`flex w-full items-center justify-between rounded-default border-[3px] border-border px-4 py-3 text-left shadow-[var(--shadow-card)] ${
                  clickable
                    ? "bg-surface hover:bg-surface-soft"
                    : "cursor-default bg-muted-soft text-muted"
                }`}
              >
                <span className="font-medium text-ink">{formatDateJa(date)}</span>
                <StatusBadge tone={statusTone(status)}>{rightLabel}</StatusBadge>
              </button>
            </li>
          );
        })}
      </ul>

      <Button
        className="mt-6"
        variant="secondary"
        fullWidth
        onClick={() => navigate("/parent")}
      >
        保護者ホームへ
      </Button>
    </ParentPageFrame>
  );
}
