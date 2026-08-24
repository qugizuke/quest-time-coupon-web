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
import { homeQuery, queryKeys, resultsQuery } from "@/api/queries";
import { ChildPageFrame } from "@/components/layout/ChildPageFrame";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/StatusBadge";
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { formatDateJa, formatDayNumber, formatWeekdayJa, todayLocal } from "@/lib/date";
import { actualDoneLabel, childAnswerLabel, isUnknownChildAnswer } from "@/lib/labels";
import { isSkipAnswerQuest, resolveQuestTitle } from "@/lib/questLabels";
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

/** 採点拒否（grade_rejected）の理由文（screen-design §6.5） */
const GRADE_REJECTED_REASON =
  "ママが採点を拒否しました。ママをどんな気持ちにさせたか、振り返ってみよう。";

/** 未登録（unregistered）の理由文（screen-design §6.5） */
const UNREGISTERED_REASON = "クエストが登録されませんでした（-60分）";

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
  const pointsText = `${item.totalPoints >= 0 ? "+" : ""}${item.totalPoints}分`;
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

/**
 * 未確認（要確認）かどうか
 * @param {ResultItem} item - 結果
 * @returns {boolean} 要確認なら true
 */
function needsAck(item: ResultItem): boolean {
  return item.requiresAck && !item.acknowledged && item.reasonCode !== "exempt";
}

/** 登録タイミング調整の表示ラベル */
function registrationTimingLabel(adjustment: number, reason?: string): string {
  if (reason) return reason;
  if (adjustment > 0) return `定時登録ボーナス +${adjustment}分`;
  if (adjustment < 0) return `登録締切超過 ${adjustment}分`;
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
  const { data: homeData } = useQuery(homeQuery);
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
  const unackedCount = items.filter((item) => needsAck(item)).length;
  const hasMultipleUnacked = unackedCount > 1;
  const penaltyPreviewOffset =
    selected && needsAck(selected) && selected.totalPoints > 0
      ? Math.min(homeData?.penaltyMinutes ?? 0, selected.totalPoints)
      : 0;
  const effectiveDeltaPreview = selected
    ? selected.totalPoints - penaltyPreviewOffset
    : 0;

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
          balanceMinutes: ack.balanceMinutes ?? ack.displayBalance,
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
      <div className="mb-6">
        <p className="text-sm text-muted">📊 週ごとの結果</p>
        <h1 className="text-app-lg font-bold">採点結果</h1>
      </div>

      {!selected && (
        <div className="flex flex-col gap-4" data-testid="results-week-list">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="secondary"
              className="px-3 text-base"
              onClick={() => setWeekOffset((v) => v - 1)}
              data-testid="results-prev-week"
            >
              ← 前週
            </Button>
            <p className="text-center text-sm font-medium" data-testid="results-week-label">
              {formatWeekLabel(monday)}
            </p>
            <Button
              variant="secondary"
              className="px-3 text-base"
              onClick={() => setWeekOffset((v) => v + 1)}
              data-testid="results-next-week"
            >
              翌週 →
            </Button>
          </div>

          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {weekDates.map((date) => {
              const item = byDate.get(date);
              const clickable = !!item;
              const unacked = item ? needsAck(item) : false;
              const card = weekCardLabel(item);
              return (
                <li key={date}>
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
                    className={`flex w-full flex-col items-center gap-1 rounded-default px-2 py-3 text-center ${
                      clickable
                        ? unacked
                          ? "border-[3px] border-danger bg-surface shadow-[var(--shadow-card)]"
                          : "border-[3px] border-border bg-surface shadow-[var(--shadow-card)]"
                        : "cursor-default border border-transparent bg-muted-soft text-muted"
                    }`}
                  >
                    <span className="font-display text-2xl leading-none text-ink">
                      {formatDayNumber(date)}
                    </span>
                    <span className="text-xs text-muted">{formatWeekdayJa(date)}</span>
                    <span
                      className={[
                        "text-sm font-bold",
                        card.tone === "danger"
                          ? "text-danger"
                          : card.tone === "success"
                            ? "text-success"
                            : card.tone === "info"
                              ? "text-info"
                              : "text-muted",
                      ].join(" ")}
                    >
                      {card.pointsText}
                    </span>
                    {card.statusText && (
                      <StatusBadge tone={card.tone}>{card.statusText}</StatusBadge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
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
              <span className="ml-2 font-sans text-xl font-normal">分</span>
            </p>
            {needsAck(selected) && penaltyPreviewOffset > 0 && (
              <p className="mt-2 text-sm text-muted">
                {hasMultipleUnacked ? "この結果を先に確認すると、" : ""}
                超過ペナルティ {penaltyPreviewOffset}分を相殺後、実質{" "}
                {effectiveDeltaPreview >= 0 ? "+" : ""}
                {effectiveDeltaPreview}分
              </p>
            )}
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
                  selected.registrationTimingReason,
                )}
              </div>
            )}

          {selected.reasonCode === "normal" &&
            !!selected.bedtimePrepPenalty &&
            selected.bedtimePrepPenalty !== 0 && (
              <div className="rounded-default border-2 border-danger bg-danger/10 px-4 py-3 text-base text-ink">
                {selected.bedtimePrepPenaltyReason ??
                  `寝る準備の虚偽ペナルティ ${selected.bedtimePrepPenalty}分`}
              </div>
            )}

          {selected.reasonCode === "normal" &&
            (selected.adjustments ?? []).length > 0 && (
              <ul className="flex flex-col gap-2">
                {selected.adjustments!.map((adj) => (
                  <li
                    key={`${adj.kind}-${adj.code}`}
                    className={`rounded-default px-4 py-3 text-base ${
                      adj.minutes > 0
                        ? "border-2 border-success bg-success/10 text-ink"
                        : "border-2 border-danger bg-danger/10 text-ink"
                    }`}
                  >
                    {adj.label}: {adj.minutes > 0 ? "+" : ""}
                    {adj.minutes}分
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
                  <p className="text-sm text-muted">{d.finalPoints}分</p>
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
