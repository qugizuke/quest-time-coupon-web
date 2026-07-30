/**
 * @file ResultsPage
 * @description 採点結果の週ナビ＋日詳細前面・「確認した」操作（Issue #17 / screen-design §6.5）。
 * @limitation API/DB 本接続は含まない。免除日詳細の完了 CTA は省略（自動確認扱い）。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postResultsAck } from "@/api/client";
import { homeQuery, queryKeys, resultsQuery } from "@/api/queries";
import { ChildPageFrame } from "@/components/layout/ChildPageFrame";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/StatusBadge";
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { formatDateJa, todayLocal } from "@/lib/date";
import { actualDoneLabel, childAnswerLabel, isUnknownChildAnswer } from "@/lib/labels";
import { resolveQuestTitle } from "@/lib/questLabels";
import {
  formatWeekLabel,
  getMondayWithOffset,
  getWeekDates,
  getWeekOffsetBetween,
} from "@/lib/week";
import type { ReasonCode, ResultItem } from "@/types/api";

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
 * 週一覧の右側ラベルを返す
 * @param {ResultItem | undefined} item - 結果1件
 * @returns {{ text: string; tone: StatusBadgeTone }} 表示
 */
function weekRowLabel(item: ResultItem | undefined): {
  text: string;
  tone: StatusBadgeTone;
} {
  if (!item) {
    return { text: "結果なし", tone: "muted" };
  }
  if (item.reasonCode === "exempt") {
    return { text: "免除 ±0", tone: "info" };
  }
  const pointsText = `${item.totalPoints >= 0 ? "+" : ""}${item.totalPoints}分`;
  if (item.requiresAck && !item.acknowledged) {
    return { text: `${pointsText}・未確認`, tone: "danger" };
  }
  if (item.reasonCode === "grade_rejected") {
    return { text: pointsText, tone: "danger" };
  }
  if (item.reasonCode === "unregistered") {
    return { text: pointsText, tone: "danger" };
  }
  return {
    text: pointsText,
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
    return "border-2 border-success bg-success/10 text-gray-900";
  }
  if (adjustment < 0) {
    return "border-2 border-danger bg-danger/10 text-gray-900";
  }
  return "border-2 border-warning bg-warning/20 text-gray-900";
}

/**
 * 採点結果画面（週ナビ＋日詳細前面）
 * @returns {JSX.Element} ページ
 */
export function ResultsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = todayLocal();
  const { data, isLoading, error } = useQuery(resultsQuery);
  const { data: homeData } = useQuery(homeQuery);
  const { data: daily } = useDailyQuests();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekInitialized, setWeekInitialized] = useState(false);

  const items = data?.items ?? [];

  useEffect(() => {
    if (!data || weekInitialized) return;
    const unackedDates = items
      .filter((item) => needsAck(item))
      .map((item) => item.date)
      .sort();
    if (unackedDates.length > 0) {
      setWeekOffset(getWeekOffsetBetween(today, unackedDates[0]));
    } else {
      setWeekOffset(0);
    }
    setWeekInitialized(true);
  }, [data, items, today, weekInitialized]);

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
    onSuccess: (_data, date) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({ queryKey: queryKeys.results });

      const current = queryClient.getQueryData<{
        items: Array<{ date: string; acknowledged: boolean; requiresAck: boolean; reasonCode: ReasonCode }>;
      }>(queryKeys.results);
      const hasOtherUnacked = (current?.items ?? []).some(
        (item) =>
          item.date !== date &&
          item.requiresAck &&
          !item.acknowledged &&
          item.reasonCode !== "exempt",
      );

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

  if (error) {
    return (
      <ChildPageFrame>
        <p className="text-danger">{error instanceof Error ? error.message : "エラー"}</p>
      </ChildPageFrame>
    );
  }

  return (
    <ChildPageFrame>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-app-lg font-bold">採点結果</h1>
        <Button variant="secondary" onClick={() => navigate("/")}>
          ホーム
        </Button>
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

          <ul className="flex flex-col gap-2">
            {weekDates.map((date) => {
              const item = byDate.get(date);
              const clickable = !!item;
              const unacked = item ? needsAck(item) : false;
              const right = weekRowLabel(item);
              return (
                <li key={date}>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => {
                      if (clickable) setSelectedDate(date);
                    }}
                    data-testid={`results-day-${date}`}
                    data-reason-code={item?.reasonCode ?? ""}
                    data-unacked={unacked ? "true" : "false"}
                    className={`flex w-full items-center justify-between rounded-default px-4 py-3 text-left shadow-sm ${
                      clickable
                        ? unacked
                          ? "border-2 border-danger bg-white"
                          : "border border-border bg-white"
                        : "cursor-default border border-transparent bg-muted-soft text-muted"
                    }`}
                  >
                    <span className="font-medium">{formatDateJa(date)}</span>
                    <StatusBadge tone={right.tone}>{right.text}</StatusBadge>
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
                ? "border-2 border-border"
                : selected.totalPoints >= 0
                  ? "border-2 border-success"
                  : "border-2 border-danger"
            }
          >
            <p className="text-lg font-bold">{formatDateJa(selected.date)}</p>
            <p className="text-app-lg font-bold">
              {selected.totalPoints >= 0 ? "+" : ""}
              {selected.totalPoints} 分
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

          {selected.details.some((d) => isUnknownChildAnswer(d.childAnswer)) && (
            <div className="rounded-default border-2 border-warning bg-warning/20 px-4 py-3 text-base text-gray-900">
              {UNKNOWN_ANSWER_MESSAGE}
            </div>
          )}

          {reasonCodeMessage(selected.reasonCode) && (
            <div
              className={`rounded-default px-4 py-3 text-base ${
                selected.reasonCode === "exempt"
                  ? "border-2 border-border bg-info-soft text-gray-900"
                  : "border-2 border-danger bg-danger/10 text-gray-900"
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
              <div className="rounded-default border-2 border-danger bg-danger/10 px-4 py-3 text-base text-gray-900">
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
                        ? "border-2 border-success bg-success/10 text-gray-900"
                        : "border-2 border-danger bg-danger/10 text-gray-900"
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
                    自分の回答: {childAnswerLabel(d.childAnswer)}
                  </p>
                  {isUnknown ? (
                    <p className="text-sm text-muted">ママの採点: なし（自動減点）</p>
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
          <Button
            variant="secondary"
            fullWidth
            onClick={() => setSelectedDate(null)}
            data-testid="results-back-to-week"
          >
            一覧に戻る
          </Button>
        </div>
      )}
    </ChildPageFrame>
  );
}
