/**
 * @file ResultsPage
 * @description 採点結果の週ナビ＋日詳細前面・「確認した」操作（Issue #17 / screen-design §6.5）。
 *   週一覧は Figma kid-results-week の7列カード構成に寄せる（Issue #19）。
 * @limitation API/DB 本接続は含まない。免除日詳細の完了 CTA は省略（自動確認扱い）。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { postResultsAck } from "@/api/client";
import { queryKeys, resultsQuery } from "@/api/queries";
import { ChildPageFrame } from "@/components/layout/ChildPageFrame";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/StatusBadge";
import {
  formatDateJaFullWidth,
  formatDayNumber,
  formatWeekdayJa,
  todayLocal,
} from "@/lib/date";
import { isUnknownChildAnswer } from "@/lib/labels";
import { isSkipAnswerQuest } from "@/lib/questLabels";
import { pointsUnitLabel } from "@/lib/points";
import {
  formatWeekLabel,
  getMondayWithOffset,
  getWeekDates,
  getWeekOffsetBetween,
} from "@/lib/week";
import type { HomeData, ReasonCode, ResultItem } from "@/types/api";

/** React Query に保存する採点結果一覧 */
interface ResultsCacheData {
  items: ResultItem[];
}

/** 「分からない」回答がある日の促しメッセージ */
const UNKNOWN_ANSWER_MESSAGE =
  "「分からない」は、その日クエストを意識できていなかった扱いで大きめの減点だよ。次からは思い出して「できた」「できなかった」で答えよう！";

/** Figma kid-results-detail の結果説明文 */
const APPROVED_REASON =
  "今日のクエストを達成して、ごほうびポイントを獲得しました！";
const GRADE_REJECTED_REASON =
  "おうちの人が採点をキャンセルしました。ポイントが引かれています。";
const UNREGISTERED_REASON =
  "クエストが登録されませんでした。ポイントが引かれています。";
const EXEMPT_REASON =
  "今日はクエスト免除日でした。ポイントの増減はありません。";

/**
 * reasonCode ごとの理由文言を返す
 * @param {ReasonCode} reasonCode - 結果種別
 * @returns {string | null} 表示文言（通常採点は null）
 */
function reasonCodeMessage(reasonCode: ReasonCode): string | null {
  if (reasonCode === "grade_rejected") return GRADE_REJECTED_REASON;
  if (reasonCode === "unregistered") return UNREGISTERED_REASON;
  if (reasonCode === "exempt") return EXEMPT_REASON;
  return null;
}

/** Figma の結果カード用バッジ */
function resultBadge(reasonCode: ReasonCode): {
  label: string;
  className: string;
} {
  if (reasonCode === "grade_rejected") {
    return {
      label: "採点キャンセル",
      className: "border-danger bg-danger/5 text-danger",
    };
  }
  if (reasonCode === "unregistered") {
    return {
      label: "未登録",
      className: "border-primary bg-primary/5 text-primary",
    };
  }
  if (reasonCode === "exempt") {
    return {
      label: "免除日",
      className: "border-border bg-muted-soft text-muted",
    };
  }
  return {
    label: "ごほうび獲得",
    className: "border-success/20 bg-success/10 text-success-deep",
  };
}

/** Figma の大表示用に点数を整形する */
function resultPointsText(item: ResultItem): string {
  if (item.reasonCode === "exempt") return `±0 ${pointsUnitLabel(item.date)}`;
  return `${item.totalPoints >= 0 ? "+" : ""}${item.totalPoints} ${pointsUnitLabel(item.date)}`;
}

/** 通常結果のカード内訳（Figma の基本3行＋契約上の追加調整） */
function resultBreakdownRows(item: ResultItem): Array<{
  label: string;
  points: number;
}> {
  const rows = [
    {
      label: "通常点（設問合算）",
      points:
        item.breakdown?.questPoints ??
        item.details.reduce((sum, detail) => sum + detail.finalPoints, 0),
    },
    {
      label: "定時登録ボーナス",
      points:
        item.breakdown?.onTimeBonus ??
        Math.max(0, item.registrationTimingAdjustment),
    },
    {
      label: "全達成ボーナス",
      points: item.breakdown?.perfectBonus ?? 0,
    },
  ];

  if (item.registrationTimingAdjustment < 0) {
    rows.push({
      label: item.registrationTimingReason ?? "登録締切超過",
      points: item.registrationTimingAdjustment,
    });
  }

  const bedtimePrepPenalty =
    item.bedtimePrepPenalty ?? item.breakdown?.bedtimePrepPenalty ?? 0;
  if (bedtimePrepPenalty !== 0) {
    rows.push({
      label: item.bedtimePrepPenaltyReason ?? "寝る準備の虚偽ペナルティ",
      points: bedtimePrepPenalty,
    });
  }

  const adjustments = item.adjustments ?? [];
  if (adjustments.length > 0) {
    for (const adjustment of adjustments) {
      rows.push({ label: adjustment.label, points: adjustment.points });
    }
  } else {
    const adjustmentsSum = item.breakdown?.adjustmentsSum ?? 0;
    if (adjustmentsSum !== 0) {
      rows.push({ label: "加減点調整", points: adjustmentsSum });
    }
  }

  return rows;
}

/**
 * 週カードの点数・状態ラベルを返す
 * @param {ResultItem | undefined} item - 結果1件
 * @returns {{ pointsText: string; statusText: string | null; tone: StatusBadgeTone }} 表示
 */
function weekCardLabel(item: ResultItem | undefined): {
  pointsText: string;
  statusText: string | null;
  tone: StatusBadgeTone;
} {
  if (!item) {
    return { pointsText: "—", statusText: "結果なし", tone: "muted" };
  }
  if (item.reasonCode === "exempt") {
    return { pointsText: "±0", statusText: "免除", tone: "info" };
  }
  const pointsText = `${item.totalPoints >= 0 ? "+" : ""}${item.totalPoints}${pointsUnitLabel(item.date)}`;
  if (item.requiresAck && !item.acknowledged) {
    return { pointsText, statusText: "未確認", tone: "danger" };
  }
  if (item.reasonCode === "grade_rejected") {
    return { pointsText, statusText: "拒否", tone: "danger" };
  }
  if (item.reasonCode === "unregistered") {
    return { pointsText, statusText: "未登録", tone: "danger" };
  }
  return {
    pointsText,
    statusText: null,
    tone: item.totalPoints >= 0 ? "success" : "danger",
  };
}

/** Figma の日付バー用ラベル */
function todayBannerLabel(date: string): string {
  return `${formatDateJaFullWidth(date)}・今日`;
}

/**
 * 未確認（要確認）かどうか
 * @param {ResultItem} item - 結果
 * @returns {boolean} 要確認なら true
 */
function needsAck(item: ResultItem): boolean {
  return item.requiresAck && !item.acknowledged && item.reasonCode !== "exempt";
}

/**
 * 採点結果画面（週ナビ＋日詳細前面）
 * @returns {JSX.Element} ページ
 */
export function ResultsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const today = todayLocal();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { data, isLoading, error } = useQuery(resultsQuery);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekInitialized, setWeekInitialized] = useState(false);
  /** 未確認バナー経由（`?unacked=1`）のとき最古未確認週へ */
  const focusOldestUnacked = searchParams.get("unacked") === "1";

  /** Result は今日以前のみ（未来の免除日は確定結果として出さない） */
  const items = useMemo(
    () => (data?.items ?? []).filter((item) => item.date <= today),
    [data?.items, today],
  );

  useEffect(() => {
    if (!data || weekInitialized) return;
    if (focusOldestUnacked) {
      const unackedDates = items
        .filter((item) => needsAck(item))
        .map((item) => item.date)
        .sort();
      if (unackedDates.length > 0) {
        setWeekOffset(getWeekOffsetBetween(today, unackedDates[0]));
      } else {
        setWeekOffset(0);
      }
    } else {
      setWeekOffset(0);
    }
    setWeekInitialized(true);
  }, [data, items, today, weekInitialized, focusOldestUnacked]);

  const monday = useMemo(
    () => getMondayWithOffset(today, weekOffset),
    [today, weekOffset],
  );
  const weekDates = useMemo(() => getWeekDates(monday), [monday]);

  const byDate = useMemo(() => {
    const map = new Map<string, ResultItem>();
    for (const item of items) {
      map.set(item.date, item);
    }
    return map;
  }, [items]);

  const selected = selectedDate ? byDate.get(selectedDate) : undefined;

  /**
   * 未確認分は残高へ未反映のため除外する。切替週は旧「分」と「pt」を混ぜず、
   * 結果日の単位ごとに集計する。
   */
  const weeklyTotals = useMemo(() => {
    const totals = new Map<ReturnType<typeof pointsUnitLabel>, number>();
    for (const date of weekDates) {
      const item = byDate.get(date);
      if (!item || needsAck(item)) continue;
      const unit = pointsUnitLabel(item.date);
      totals.set(unit, (totals.get(unit) ?? 0) + item.totalPoints);
    }
    if (totals.size === 0) {
      totals.set(pointsUnitLabel(monday), 0);
    }
    return [...totals.entries()].map(([unit, total]) => ({ unit, total }));
  }, [byDate, monday, weekDates]);

  const ackMutation = useMutation({
    mutationFn: (date: string) => postResultsAck(date),
    onSuccess: async (ack, date) => {
      const currentResults = queryClient.getQueryData<ResultsCacheData>(
        queryKeys.results,
      );
      const acknowledgedItem = currentResults?.items.find(
        (item) => item.date === date,
      );

      // resultsAck の成功レスポンスを先に反映し、画面遷移中も古い残高を表示しない。
      queryClient.setQueryData<HomeData>(queryKeys.home, (currentHome) => {
        if (!currentHome) return currentHome;

        const nextUnacknowledgedCount = Math.max(
          0,
          currentHome.unacknowledgedCount -
            (acknowledgedItem && needsAck(acknowledgedItem) ? 1 : 0),
        );
        const nextTimerBlockCount = Math.max(
          0,
          currentHome.timerBlockCount - (acknowledgedItem?.blocksTimer ? 1 : 0),
        );

        return {
          ...currentHome,
          balancePoints: ack.balancePoints ?? currentHome.balancePoints,
          switchMinutes: ack.switchMinutes ?? ack.displayBalance,
          displayBalance: ack.displayBalance,
          penaltyMinutes: ack.penaltyMinutes,
          debtMinutes: ack.debtMinutes ?? 0,
          issuablePenaltyTicketCount: ack.issuablePenaltyTicketCount ?? 0,
          unacknowledgedCount: nextUnacknowledgedCount,
          timerBlockCount: nextTimerBlockCount,
          canStartTimer:
            ack.displayBalance > 0 &&
            ack.penaltyMinutes === 0 &&
            nextTimerBlockCount === 0,
          todayStatus:
            currentHome.today === date &&
            currentHome.todayStatus === "pending_ack"
              ? "completed"
              : currentHome.todayStatus,
        };
      });
      queryClient.setQueryData<ResultsCacheData>(
        queryKeys.results,
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((item) =>
                  item.date === date ? { ...item, acknowledged: true } : item,
                ),
              }
            : current,
      );

      // 件数や当日状態は home/results を正として再同期してから遷移する。
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.home }),
        queryClient.invalidateQueries({ queryKey: queryKeys.results }),
      ]);

      const refreshed = queryClient.getQueryData<ResultsCacheData>(
        queryKeys.results,
      );
      const hasOtherUnacked = (refreshed?.items ?? []).some(needsAck);

      if (hasOtherUnacked) {
        setSelectedDate(null);
      } else {
        navigate("/");
      }
    },
  });

  if (isLoading) {
    return (
      <ChildPageFrame>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted">読み込み中…</p>
        </div>
      </ChildPageFrame>
    );
  }

  // 再取得失敗時も保持済みデータがあれば画面を継続し、ack 成功後の表示を失わない。
  if (error && !data) {
    return (
      <ChildPageFrame>
        <p className="text-danger">
          {error instanceof Error ? error.message : "エラー"}
        </p>
      </ChildPageFrame>
    );
  }

  return (
    <ChildPageFrame>
      {!selected && (
        <div className="flex flex-col gap-6" data-testid="results-week-list">
          <div
            className="w-full rounded-default border-[3px] border-border bg-surface px-6 py-3 text-[22px] leading-none text-ink"
            data-testid="results-today-banner"
          >
            {todayBannerLabel(today)}
          </div>

          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              className="h-[58px] w-[120px] shrink-0 p-3 text-base font-normal"
              onClick={() => setWeekOffset((v) => v - 1)}
              data-testid="results-prev-week"
            >
              ← 前週
            </Button>
            <p
              className="flex-1 text-center text-[22px] leading-none"
              data-testid="results-week-label"
            >
              {formatWeekLabel(monday)}
            </p>
            <Button
              variant="secondary"
              className="h-[58px] w-[120px] shrink-0 p-3 text-base font-normal"
              onClick={() => setWeekOffset((v) => v + 1)}
              data-testid="results-next-week"
            >
              翌週 →
            </Button>
          </div>

          <ul className="grid grid-cols-7 gap-3 overflow-x-auto pt-3">
            {weekDates.map((date) => {
              const item = byDate.get(date);
              const clickable = !!item;
              const unacked = item ? needsAck(item) : false;
              const isToday = date === today;
              const highlighted = isToday || unacked;
              const card = weekCardLabel(item);
              return (
                <li key={date} className="min-w-[112px]">
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => {
                      if (clickable) {
                        ackMutation.reset();
                        setSelectedDate(date);
                      }
                    }}
                    data-testid={`results-day-${date}`}
                    data-reason-code={item?.reasonCode ?? ""}
                    data-unacked={unacked ? "true" : "false"}
                    className={`relative flex h-[180px] w-full flex-col items-center gap-2 rounded-default border-[3px] px-3 pb-3 pt-4 text-center ${
                      highlighted
                        ? "border-primary bg-warning/15"
                        : clickable
                          ? "border-border bg-surface"
                          : "cursor-default border-border bg-muted-soft opacity-70"
                    }`}
                  >
                    {isToday && (
                      <span className="absolute -top-[15px] left-1/2 -translate-x-1/2 rounded-[12px] bg-primary px-2.5 py-[3px] text-[11px] leading-none text-white">
                        今日
                      </span>
                    )}
                    <span className="flex items-center gap-2">
                      <span className="text-sm text-muted">
                        {formatDayNumber(date)}
                      </span>
                      <span
                        className={`flex size-10 items-center justify-center rounded-full text-lg ${
                          highlighted
                            ? "bg-primary text-white"
                            : "bg-info-soft text-info"
                        }`}
                      >
                        {formatWeekdayJa(date)}
                      </span>
                    </span>
                    {unacked ? (
                      <>
                        <StatusBadge tone="warning">🔔 未確認</StatusBadge>
                        <span className="text-[13px] leading-[22px] text-primary">
                          確認する →
                        </span>
                      </>
                    ) : item ? (
                      <>
                        <StatusBadge tone={card.tone}>
                          {card.statusText ?? "✅ 採点済み"}
                        </StatusBadge>
                        <span className="text-[15px] leading-[22px] text-ink">
                          {card.pointsText}
                        </span>
                      </>
                    ) : (
                      <>
                        <StatusBadge tone="muted">— 結果なし</StatusBadge>
                        <span className="text-xs text-muted">結果なし</span>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div
            className="flex w-full items-center justify-between rounded-default border-[3px] border-border bg-surface px-6 py-3"
            data-testid="results-weekly-summary"
          >
            <span className="text-base">週間合計</span>
            <span
              className="flex flex-wrap justify-end gap-x-2 font-display text-[32px] leading-none"
              data-testid="results-weekly-total"
            >
              {weeklyTotals.map(({ unit, total }, index) => (
                <span
                  key={unit}
                  className={total >= 0 ? "text-success" : "text-danger"}
                >
                  {index > 0 && <span className="mr-2 text-muted">/</span>}
                  {total >= 0 ? "+" : ""}
                  {total}
                  {unit}
                </span>
              ))}
            </span>
          </div>
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-6" data-testid="results-day-detail">
          <h1 className="text-[22px] font-bold leading-tight text-ink">
            {formatDateJaFullWidth(selected.date)}
          </h1>

          <Card className="flex min-h-[460px] flex-col gap-6 p-7 sm:p-8">
            <div>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-sm ${resultBadge(selected.reasonCode).className}`}
                data-testid="results-detail-badge"
              >
                {resultBadge(selected.reasonCode).label}
              </span>
            </div>

            <p
              className={`font-display text-[40px] font-bold leading-none ${
                selected.reasonCode === "normal" && selected.totalPoints >= 0
                  ? "text-success"
                  : selected.reasonCode === "exempt"
                    ? "text-ink"
                    : "text-danger"
              }`}
              data-testid="results-detail-points"
            >
              {resultPointsText(selected)}
              {selected.reasonCode === "normal" &&
                selected.totalPoints >= 0 && (
                  <span
                    className="ml-2 text-[34px] text-success"
                    aria-hidden="true"
                  >
                    ☆
                  </span>
                )}
            </p>

            <p
              className="text-base leading-relaxed text-ink"
              data-testid="reason-code-message"
              data-reason-code={selected.reasonCode}
            >
              {selected.reasonCode === "normal"
                ? APPROVED_REASON
                : reasonCodeMessage(selected.reasonCode)}
            </p>

            {selected.reasonCode === "normal" && (
              <ul className="mt-1" data-testid="results-breakdown">
                {resultBreakdownRows(selected).map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between gap-4 border-b border-border/30 py-4 first:border-t"
                  >
                    <span>{row.label}</span>
                    <span className="shrink-0">
                      {row.points >= 0 ? "+" : ""}
                      {row.points} {pointsUnitLabel(selected.date)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {selected.details.some(
              (detail) =>
                isUnknownChildAnswer(detail.childAnswer) &&
                !isSkipAnswerQuest(detail.questId, detail.gradingMode),
            ) && (
              <div className="rounded-default border-2 border-warning bg-warning/20 px-4 py-3 text-base text-ink">
                {UNKNOWN_ANSWER_MESSAGE}
              </div>
            )}

            <div className="mt-auto flex flex-col gap-3 pt-3">
              {needsAck(selected) && (
                <Button
                  fullWidth
                  onClick={() => ackMutation.mutate(selected.date)}
                  disabled={ackMutation.isPending}
                  data-testid="results-ack-button"
                >
                  確認した
                </Button>
              )}
              {ackMutation.error && (
                <p className="text-danger" role="alert">
                  {ackMutation.error instanceof Error
                    ? ackMutation.error.message
                    : "採点結果を確認できませんでした"}
                </p>
              )}
              <Button
                variant="ghost"
                fullWidth
                className="text-base font-normal"
                onClick={() => {
                  ackMutation.reset();
                  setSelectedDate(null);
                }}
                data-testid="results-back-to-week"
              >
                一覧に戻る
              </Button>
            </div>
          </Card>
        </div>
      )}
    </ChildPageFrame>
  );
}
