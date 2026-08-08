/**
 * @file QuestConfirmPage
 * @description 回答一覧の最終確認と登録。条件付きで翌日起床時刻を設定する（Issue #16）。
 *   長期休み最終日（翌日平日）は起床 UI 非表示・wakePromise 未送信（Functions が 07:15 を書く）。
 *   Figma kid-quest-confirm の横向き2カラム（左回答／右 CTA）に寄せる（Issue #19）。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postAnswers } from "@/api/client";
import { homeQuery, longVacationQuery, queryKeys } from "@/api/queries";
import { ChildPageFrame } from "@/components/layout/ChildPageFrame";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { todayLocal } from "@/lib/date";
import {
  isBeforeQuestRegistrationStart,
  isPastQuestRegistrationCutoff,
  isWeekendEve,
} from "@/lib/deadline";
import { isRegistrationReopenActive } from "@/lib/registrationReopen";
import {
  DEFAULT_WAKE_UP,
  shouldShowWakeUpSetting,
  WAKE_UP_OPTIONS,
} from "@/lib/homeMode";
import { childAnswerLabel } from "@/lib/labels";
import { HOMEWORK_QUEST_ID, PHONE_QUEST_ID } from "@/lib/questLabels";
import {
  getQuestDraft,
  clearQuestDraft,
  getBedtimeHourDraft,
} from "@/lib/sessionStorage";
import type {
  BedtimeHour,
  ChildAnswer,
  DailyQuests,
  GradingMode,
  QuestDefinition,
  QuestDraft,
  SelectableWakeTime,
} from "@/types/api";

/**
 * API に送信する回答を下書きから構築する
 * @param {DailyQuests} daily - クエスト定義
 * @param {QuestDraft} draft - 下書き
 * @returns {{ questId: string; childAnswer: ChildAnswer }[]} 送信対象回答
 */
function buildSubmittableAnswers(
  daily: DailyQuests,
  draft: QuestDraft,
): { questId: string; childAnswer: ChildAnswer }[] {
  return daily.quests.flatMap((q) => {
    const a = draft.answers.find((x) => x.questId === q.id);
    if (q.conditional?.persistGateAnswer === false) {
      const gateAnswer = draft.gateAnswers?.[q.id];
      if (gateAnswer === undefined) {
        throw new Error(`QuestConfirmPage: ゲート未回答 questId=${q.id}`);
      }
      if (gateAnswer !== q.conditional.followUpWhen) {
        return [];
      }
      if (a?.childAnswer === undefined) {
        throw new Error(`QuestConfirmPage: 追問未回答 questId=${q.id}`);
      }
      return [{ questId: q.id, childAnswer: a.childAnswer }];
    }
    if (a?.childAnswer !== undefined) {
      return [{ questId: q.id, childAnswer: a.childAnswer }];
    }
    throw new Error(`QuestConfirmPage: 未回答 questId=${q.id}`);
  });
}

/**
 * 確認画面に表示するタイトルを返す
 * @param {QuestDefinition} quest - クエスト定義
 * @returns {string} 表示タイトル
 */
function confirmationTitle(quest: QuestDefinition): string {
  return quest.conditional?.followUpTitle ?? quest.title;
}

/**
 * 確認画面に表示する行を返す
 * @param {DailyQuests} daily - クエスト定義
 * @param {QuestDraft} draft - 下書き
 * @returns {{ questId: string; title: string; childAnswer: ChildAnswer }[]} 表示行
 */
function buildConfirmationItems(
  daily: DailyQuests,
  draft: QuestDraft,
): { questId: string; title: string; childAnswer: ChildAnswer }[] {
  const answers = buildSubmittableAnswers(daily, draft);
  const answerMap = new Map(answers.map((answer) => [answer.questId, answer.childAnswer]));
  return daily.quests.flatMap((q) => {
    const childAnswer = answerMap.get(q.id);
    if (childAnswer === undefined) return [];
    return [{ questId: q.id, title: confirmationTitle(q), childAnswer }];
  });
}

/**
 * 起床ラベルを表示用に変換する
 * @param {SelectableWakeTime} time - 起床時刻（UI 選択値）
 * @returns {string} 例: 8:00
 */
function wakeUpLabel(time: SelectableWakeTime): string {
  const [h, m] = time.split(":");
  return `${Number(h)}:${m}`;
}

/**
 * 確認画面（live 回答）用の gradingMode。
 * 専用3択で -1 を選んだ場合は skip として表示する（履歴の旧データ保護とは別文脈）。
 * @param {string} questId - クエスト ID
 * @param {ChildAnswer} childAnswer - 子ども回答
 * @returns {GradingMode | undefined} skip なら "skip"、それ以外は未指定
 */
function liveGradingModeForLabel(
  questId: string,
  childAnswer: ChildAnswer,
): GradingMode | undefined {
  if (
    childAnswer === -1 &&
    (questId === HOMEWORK_QUEST_ID || questId === PHONE_QUEST_ID)
  ) {
    return "skip";
  }
  return undefined;
}

/**
 * 最終確認画面
 * @returns {JSX.Element} ページ
 */
export function QuestConfirmPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const date = todayLocal();
  const { data: daily } = useDailyQuests();
  const { data: homeData, isLoading: isHomeLoading } = useQuery(homeQuery);
  const {
    data: longVacation,
    isLoading: isLongVacationLoading,
  } = useQuery(longVacationQuery);
  const draft = getQuestDraft(date);
  const [wakeUpTime, setWakeUpTime] =
    useState<SelectableWakeTime>(DEFAULT_WAKE_UP);
  let confirmationItems:
    | { questId: string; title: string; childAnswer: ChildAnswer }[]
    | null = null;
  let draftError: string | null = null;

  if (draft && daily) {
    try {
      confirmationItems = buildConfirmationItems(daily, draft);
    } catch (error) {
      draftError =
        error instanceof Error
          ? error.message
          : "QuestConfirmPage: 下書きが不完全です";
    }
  }

  const vacationPeriod =
    longVacation?.startDate && longVacation?.endDate
      ? { startDate: longVacation.startDate, endDate: longVacation.endDate }
      : null;
  const showWakeUp =
    !!homeData &&
    !homeData.isExemptDay &&
    shouldShowWakeUpSetting(
      date,
      homeData.isVacationMode,
      vacationPeriod,
    );
  const vacationMode = homeData?.isVacationMode === true;

  useEffect(() => {
    if (!homeData) return;
    if (homeData.isExemptDay || homeData.questAction === "none") {
      navigate("/", { replace: true });
      return;
    }
    if (homeData.questAction !== "start") return;
    const bedtimeHour = getBedtimeHourDraft(date) ?? homeData.bedtimeHour;
    const now = new Date();
    const reopenActive = isRegistrationReopenActive(homeData.registrationReopen);
    if (
      !reopenActive &&
      (isBeforeQuestRegistrationStart(date, now, bedtimeHour) ||
        isPastQuestRegistrationCutoff(date, now, bedtimeHour))
    ) {
      navigate("/", { replace: true });
    }
  }, [date, homeData, navigate]);

  const mutation = useMutation({
    mutationFn: () => {
      if (!draft || !daily) {
        throw new Error("QuestConfirmPage: 下書きまたは定義がありません");
      }
      const answers = buildSubmittableAnswers(daily, draft);
      const canSendBedtime =
        isWeekendEve(date) || !!homeData?.isVacationMode;
      const bedtimeHour: BedtimeHour | undefined = canSendBedtime
        ? (getBedtimeHourDraft(date) ?? homeData?.bedtimeHour)
        : undefined;
      // 長期休み最終日（翌日平日）は showWakeUp=false のため wakePromise を送らない
      return postAnswers({
        date,
        answers,
        bedtimeHour,
        wakePromise: showWakeUp ? { wakeTime: wakeUpTime } : undefined,
      });
    },
    onSuccess: () => {
      clearQuestDraft(date);
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      navigate("/");
    },
  });

  // 長期休み中は最終日判定のため期間の読込を待つ（誤って wakePromise を送らない）
  if (isHomeLoading || (vacationMode && isLongVacationLoading)) {
    return (
      <ChildPageFrame vacationMode={vacationMode}>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted">読み込み中…</p>
        </div>
      </ChildPageFrame>
    );
  }

  if (!draft || !daily || !confirmationItems || draftError) {
    return (
      <ChildPageFrame vacationMode={vacationMode}>
        <p className="text-danger">
          {draftError ?? "下書きが見つかりません。"}
        </p>
        <Button className="mt-4" onClick={() => navigate("/quest")}>
          クエストに戻る
        </Button>
      </ChildPageFrame>
    );
  }

  return (
    <ChildPageFrame vacationMode={vacationMode}>
      <h1 className="mb-4 text-app-lg font-bold">最後の確認</h1>

      {/*
        Figma kid-quest-confirm: 左に回答一覧、右に起床＋登録／修正 CTA。
        縦・狭幅のみ1列。登録 CTA は緑（success）。
      */}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(240px,0.9fr)] md:items-start">
        <Card className="border-4 p-4">
          <ul className="flex flex-col gap-2">
            {confirmationItems.map((item) => (
              <li
                key={item.questId}
                className="flex justify-between gap-3 rounded-default border border-border-soft bg-surface-soft px-4 py-3"
              >
                <span className="min-w-0">{item.title}</span>
                <span className="shrink-0 font-medium text-ink">
                  {childAnswerLabel(
                    item.childAnswer,
                    "default",
                    item.questId,
                    liveGradingModeForLabel(item.questId, item.childAnswer),
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          {showWakeUp && (
            <Card data-testid="wake-up-section">
              <h2 className="mb-3 text-base font-bold">明日の起きる時間</h2>
              <div className="flex flex-wrap gap-2">
                {WAKE_UP_OPTIONS.map((option) => {
                  const selected = wakeUpTime === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setWakeUpTime(option)}
                      className={[
                        "min-h-touch rounded-default px-4 text-base",
                        selected
                          ? "border-[3px] border-info bg-info-soft text-info"
                          : "border-2 border-border bg-surface text-ink",
                      ].join(" ")}
                    >
                      {wakeUpLabel(option)}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          {mutation.error && (
            <p className="text-danger">
              {mutation.error instanceof Error ? mutation.error.message : "登録失敗"}
            </p>
          )}
          <div className="flex flex-col gap-3">
            <Button
              fullWidth
              variant="success"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              登録する
            </Button>
            <Button
              fullWidth
              variant="secondary"
              onClick={() => navigate("/quest")}
            >
              修正する
            </Button>
          </div>
        </div>
      </div>
    </ChildPageFrame>
  );
}

