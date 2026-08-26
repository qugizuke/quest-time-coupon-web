/**
 * @file GradeListPage
 * @description 保護者採点日一覧（月曜始まり週ナビ・未採点のみフィルタ）。status / isExempt は gradeDates API を正とする。
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
import { isOnOrAfterPointsCutover } from "@/lib/points";
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
 * 日次ポイントの単位ラベルを返す（ADR-005: 切替日前は「分（旧）」、以降は「pt」）
 * @param {string} date - 採点対象日（YYYY-MM-DD）
 * @returns {string} 単位ラベル
 */
function pointsUnitLabel(date: string): string {
  return isOnOrAfterPointsCutover(date) ? "pt" : "分（旧）";
}

/**
 * 行の日付ラベル（Figma 採点日一覧: 全角括弧）
 * @param {string} date - YYYY-MM-DD
 * @returns {string} 例: 2026年8月26日（水）
 */
function rowDateLabel(date: string): string {
  return formatDateJa(date).replace("(", "（").replace(")", "）");
}

/**
 * 採点日一覧
 * @returns {JSX.Element} ページ
 */
export function GradeListPage() {
  const navigate = useNavigate();
  const today = todayLocal();
  const [weekOffset, setWeekOffset] = useState(0);
  const [ungradedOnly, setUngradedOnly] = useState(false);
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

  /** Figma フィルタチップ「未採点のみ」: 未採点ステータスの日だけを表示する */
  const visibleDates = useMemo(
    () =>
      ungradedOnly
        ? weekDates.filter((date) => byDate.get(date)?.status === "ungraded")
        : weekDates,
    [weekDates, byDate, ungradedOnly],
  );

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
      <div className="mb-4">
        <h1 className="text-app-lg font-bold text-ink">採点日一覧</h1>
        <p className="mt-1 text-sm text-muted">未採点の日をタップして採点</p>
      </div>

      <div className="mb-3 flex items-center justify-between gap-2">
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

      <div className="mb-3 flex justify-start">
        <button
          type="button"
          aria-pressed={ungradedOnly}
          onClick={() => setUngradedOnly((v) => !v)}
          data-testid="ungraded-only-chip"
          className={`inline-flex min-h-touch items-center gap-1.5 rounded-pill border-[3px] px-4 text-sm font-medium transition-colors ${
            ungradedOnly
              ? "border-primary bg-primary text-white"
              : "border-border bg-surface text-ink hover:bg-surface-soft"
          }`}
        >
          {ungradedOnly && <span aria-hidden="true">✓</span>}
          未採点のみ
        </button>
      </div>

      {visibleDates.length === 0 ? (
        <p
          className="rounded-default border-[3px] border-border bg-surface px-4 py-8 text-center text-sm text-muted"
          data-testid="ungraded-empty"
        >
          未採点の日はありません
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleDates.map((date) => {
            const api = byDate.get(date);
            const status: GradeListStatus = api?.status ?? "unanswered";
            const clickable = status === "ungraded" || status === "graded";
            const points = api?.totalPoints;
            const rightLabel =
              status === "graded" && points != null
                ? `${points >= 0 ? "+" : ""}${points}${pointsUnitLabel(date)}`
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
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-ink">
                      {rowDateLabel(date)}
                    </span>
                    {date === today && (
                      <span
                        className="rounded-pill bg-primary px-2 py-[3px] text-[11px] leading-none text-white"
                        data-testid={`today-tag-${date}`}
                      >
                        今日
                      </span>
                    )}
                  </span>
                  <StatusBadge tone={statusTone(status)}>{rightLabel}</StatusBadge>
                </button>
              </li>
            );
          })}
        </ul>
      )}

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
