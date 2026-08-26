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
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { formatDateJa, formatDayNumber, formatWeekdayJa, todayLocal } from "@/lib/date";
import { actualDoneLabel, childAnswerLabel, isUnknownChildAnswer } from "@/lib/labels";
import { isSkipAnswerQuest, resolveQuestTitle } from "@/lib/questLabels";
import { isOnOrAfterPointsCutover } from "@/lib/points";
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

/** 採点拒否（grade_rejected）の理由文（screen-design §6.5・Issue #37 以降 -100pt） */
const GRADE_REJECTED_REASON =
  "ママが採点を拒否しました。ママをどんな気持ちにさせたか、振り返ってみよう。（-100pt）";

/** 未登録（unregistered）の理由文（screen-design §6.5・Issue #37 以降 -100pt） */
const UNREGISTERED_REASON = "クエストが登録されませんでした（-100pt）";

/** 免除（exempt）の理由文（screen-design §6.5） */
const EXEMPT_REASON = "今日はクエスト免除日でした";

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

/**
 * 日次結果の単位ラベルを返す（ADR-005: 切替日前は「分（旧）」、以降は「pt」）
 * @param {string} date - 結果の対象日
 * @returns {string} 単位ラベル
 */
function pointsUnitLabel(date: string): string {
  return isOnOrAfterPointsCutover(date) ? "pt" : "分（旧）";
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

/** Figma の日付バー用に全角括弧へ揃える */
function todayBannerLabel(date: string): string {
  return `${formatDateJa(date).replace("(", "（").replace(")", "）")}・今日`;
}

/**
 * 未確認（要確認）かどうか
 * @param {ResultItem} item - 結果
 * @returns {boolean} 要確認なら true
 */
function needsAck(item: ResultItem): boolean {
  return item.requiresAck && !item.acknowledged && item.reasonCode !== "exempt";
}

/** 登録タイミング調整の表示ラベル */
function registrationTimingLabel(
  adjustment: number,
  unit: string,
  reason?: string,
): string {
  if (reason) return reason;
  if (adjustment > 0) return `定時登録ボーナス +${adjustment}${unit}`;
  if (adjustment < 0) return `登録締切超過 ${adjustment}${unit}`;
  return "";
}

/**
 * 定時登録ボーナス内訳の表示スタイルを返す
 * @param {number} adjustment - 調整分数
 * @returns {string} className
 */
function registrationTimingClassName(adjustment: number): string {
  if (adjustment > 0) {
    return "border-2 border-success bg-success/10 text-ink";
  }
  if (adjustment < 0) {
    return "border-2 border-danger bg-danger/10 text-ink";
  }
  return "border-2 border-warning bg-warning/20 text-ink";
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
  const { data: daily } = useDailyQuests(selectedDate ?? today);
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

  /** 未確認分は残高へ未反映のため、週間合計には確認済み結果だけを含める */
  const weeklyTotal = useMemo(
    () =>
      weekDates.reduce((total, date) => {
        const item = byDate.get(date);
        return item && !needsAck(item) ? total + item.totalPoints : total;
      }, 0),
    [byDate, weekDates],
  );

  const ackMutation = useMutation({
    mutationFn: (date: string) => postResultsAck(date),
    onSuccess: async (ack, date) => {
      const currentResults =
        queryClient.getQueryData<ResultsCacheData>(queryKeys.results);
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
          currentHome.timerBlockCount -
            (acknowledgedItem?.blocksTimer ? 1 : 0),
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
                  item.date === date
                    ? { ...item, acknowledged: true }
                    : item,
                ),
              }
            : current,
      );

      // 件数や当日状態は home/results を正として再同期してから遷移する。
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.home }),
        queryClient.invalidateQueries({ queryKey: queryKeys.results }),
      ]);

      const refreshed =
        queryClient.getQueryData<ResultsCacheData>(queryKeys.results);
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
        <p className="text-danger">{error instanceof Error ? error.message : "エラー"}</p>
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
            <p className="flex-1 text-center text-[22px] leading-none" data-testid="results-week-label">
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
                      <span className="text-sm text-muted">{formatDayNumber(date)}</span>
                      <span
                        className={`flex size-10 items-center justify-center rounded-full text-lg ${
                          highlighted ? "bg-primary text-white" : "bg-info-soft text-info"
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
                        <StatusBadge tone={card.tone === "muted" ? "muted" : "success"}>
                          {item.reasonCode === "exempt" ? "免除" : "✅ 採点済み"}
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
              className={`font-display text-[32px] leading-none ${
                weeklyTotal >= 0 ? "text-success" : "text-danger"
              }`}
              data-testid="results-weekly-total"
            >
              {weeklyTotal >= 0 ? "+" : ""}{weeklyTotal}{pointsUnitLabel(monday)}
            </span>
          </div>
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-4" data-testid="results-day-detail">
          <Card
            className={
              selected.reasonCode === "exempt"
                ? "border-[3px] border-border"
                : selected.totalPoints >= 0
                  ? "border-[3px] border-success"
                  : "border-[3px] border-danger"
            }
          >
            <p className="text-lg font-bold">{formatDateJa(selected.date)}</p>
            <p className="font-display text-app-xl leading-none text-ink">
              {selected.totalPoints >= 0 ? "+" : ""}
              {selected.totalPoints}
              <span className="ml-2 font-sans text-xl font-normal">
                {pointsUnitLabel(selected.date)}
              </span>
            </p>
          </Card>

          {selected.details.some(
            (d) =>
              isUnknownChildAnswer(d.childAnswer) &&
              !isSkipAnswerQuest(d.questId, d.gradingMode),
          ) && (
            <div className="rounded-default border-2 border-warning bg-warning/20 px-4 py-3 text-base text-ink">
              {UNKNOWN_ANSWER_MESSAGE}
            </div>
          )}

          {reasonCodeMessage(selected.reasonCode) && (
            <div
              className={`rounded-default px-4 py-3 text-base ${
                selected.reasonCode === "exempt"
                  ? "border-2 border-border bg-info-soft text-ink"
                  : "border-2 border-danger bg-danger/10 text-ink"
              }`}
              data-testid="reason-code-message"
              data-reason-code={selected.reasonCode}
            >
              {reasonCodeMessage(selected.reasonCode)}
            </div>
          )}

          {selected.reasonCode === "normal" &&
            (selected.registrationTimingAdjustment !== 0 ||
              selected.registrationTimingReason) && (
              <div
                className={`rounded-default px-4 py-3 text-base ${registrationTimingClassName(
                  selected.registrationTimingAdjustment,
                )}`}
              >
                {registrationTimingLabel(
                  selected.registrationTimingAdjustment,
                  pointsUnitLabel(selected.date),
                  selected.registrationTimingReason,
                )}
              </div>
            )}

          {selected.reasonCode === "normal" && !!selected.breakdown?.perfectBonus && (
            <div className="rounded-default border-2 border-success bg-success/10 px-4 py-3 text-base text-ink">
              全達成ボーナス +{selected.breakdown.perfectBonus}
              {pointsUnitLabel(selected.date)}
            </div>
          )}

          {selected.reasonCode === "normal" &&
            !!selected.bedtimePrepPenalty &&
            selected.bedtimePrepPenalty !== 0 && (
              <div className="rounded-default border-2 border-danger bg-danger/10 px-4 py-3 text-base text-ink">
                {selected.bedtimePrepPenaltyReason ??
                  `寝る準備の虚偽ペナルティ ${selected.bedtimePrepPenalty}${pointsUnitLabel(selected.date)}`}
              </div>
            )}

          {selected.reasonCode === "normal" &&
            (selected.adjustments ?? []).length > 0 && (
              <ul className="flex flex-col gap-2">
                {selected.adjustments!.map((adj) => (
                  <li
                    key={`${adj.kind}-${adj.code}`}
                    className={`rounded-default px-4 py-3 text-base ${
                      adj.points > 0
                        ? "border-2 border-success bg-success/10 text-ink"
                        : "border-2 border-danger bg-danger/10 text-ink"
                    }`}
                  >
                    {adj.label}: {adj.points > 0 ? "+" : ""}
                    {adj.points}
                    {pointsUnitLabel(selected.date)}
                  </li>
                ))}
              </ul>
            )}

          <ul className="flex flex-col gap-2">
            {selected.details.map((d) => {
              const title = resolveQuestTitle(daily, d.questId, {
                preferFollowUpTitle: true,
              });
              const isUnknown = isUnknownChildAnswer(d.childAnswer);
              return (
                <li
                  key={d.questId}
                  className={`rounded-default bg-white px-4 py-3 shadow-sm ${
                    d.mismatch ? "border-l-4 border-danger" : ""
                  }`}
                >
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted">
                    自分の回答: {childAnswerLabel(d.childAnswer, "default", d.questId, d.gradingMode)}
                  </p>
                  {isUnknown ? (
                    <p className="text-sm text-muted">
                      ママの採点:{" "}
                      {isSkipAnswerQuest(d.questId, d.gradingMode)
                        ? "なし（点0・ストリーク非接触）"
                        : "なし（自動減点）"}
                    </p>
                  ) : (
                    <p className="text-sm text-muted">
                      ママの採点: {actualDoneLabel(d.actualDone)}
                    </p>
                  )}
                  <p className="text-sm text-muted">
                    {d.finalPoints}
                    {pointsUnitLabel(selected.date)}
                  </p>
                </li>
              );
            })}
          </ul>

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
            variant="secondary"
            fullWidth
            onClick={() => {
              ackMutation.reset();
              setSelectedDate(null);
            }}
            data-testid="results-back-to-week"
          >
            一覧に戻る
          </Button>
        </div>
      )}
    </ChildPageFrame>
  );
}
