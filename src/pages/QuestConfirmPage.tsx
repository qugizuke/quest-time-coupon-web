/**
 * @file QuestConfirmPage
 * @description 回答一覧の最終確認と登録。条件付きで翌日起床時刻を設定する（Issue #16）。
 *   長期休み最終日（翌日平日）は起床 UI 非表示・wakePromise 未送信（Functions が 07:15 を書く）。
 *   Figma kid-quest-confirm の番号付き回答一覧／起床カード／下部 CTA に寄せる（Issue #68）。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postAnswers } from "@/api/client";
import { homeQuery, longVacationQuery, queryKeys } from "@/api/queries";
import { ChildPageFrame } from "@/components/layout/ChildPageFrame";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/StatusBadge";
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
  isVacationTransitionPeriod,
  resolveWakeUpOptions,
  shouldShowWakeUpSetting,
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
 * 回答値に対応するステータスピルの色を返す
 * @param {ChildAnswer} childAnswer - 子ども回答
 * @returns {StatusBadgeTone} ステータス色
 */
function answerBadgeTone(childAnswer: ChildAnswer): StatusBadgeTone {
  if (childAnswer === 1) return "success";
  if (childAnswer === 0) return "warning";
  return "muted";
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
  const isTransitionPeriod = isVacationTransitionPeriod(date, vacationPeriod);
  const wakeUpOptions = resolveWakeUpOptions(isTransitionPeriod);

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
      // 移行期間中は就寝21時固定のため、他の値が残っていても送らない（Issue #36）
      const bedtimeHour: BedtimeHour | undefined = isTransitionPeriod
        ? undefined
        : canSendBedtime
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
      <div className="flex flex-1 flex-col gap-4">
        <header className="flex flex-col gap-2 py-4">
          <h1 className="text-2xl leading-8 text-ink">回答のまとめ</h1>
          <p className="text-base text-ink-brand-sub">
            登録する前にかくにんしよう
          </p>
        </header>

        <ol className="flex flex-col gap-3">
          {confirmationItems.map((item, index) => (
            <li
              key={item.questId}
              className="flex items-center gap-4 rounded-card bg-surface p-4 shadow-[var(--shadow-card)]"
            >
              <span className="font-display shrink-0 text-base text-muted">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm leading-5 text-ink">
                {item.title}
              </span>
              <StatusBadge tone={answerBadgeTone(item.childAnswer)}>
                {childAnswerLabel(
                  item.childAnswer,
                  "default",
                  item.questId,
                  liveGradingModeForLabel(item.questId, item.childAnswer),
                )}
              </StatusBadge>
            </li>
          ))}
        </ol>

        {showWakeUp && (
          <section
            className="mt-2 flex flex-col gap-4 rounded-card bg-surface-warm p-6 shadow-[var(--shadow-card)]"
            data-testid="wake-up-section"
          >
            <div className="flex items-center gap-3">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-white"
                aria-hidden="true"
              >
                ★
              </span>
              <h2 className="text-2xl leading-8 text-ink">
                明日の起きる時間
              </h2>
            </div>
            <p className="text-sm leading-5 text-ink-brand-sub">
              明日は学校があるので、起きる時間をえらんでね
            </p>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(72px,1fr))] gap-3">
              {wakeUpOptions.map((option) => {
                const selected = wakeUpTime === option;
                return (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setWakeUpTime(option)}
                    className={[
                      "min-h-touch rounded-[12px] px-3 text-sm transition-colors",
                      selected
                        ? "bg-primary text-white"
                        : "bg-surface text-ink",
                    ].join(" ")}
                  >
                    {wakeUpLabel(option)}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {mutation.error && (
          <p className="text-danger">
            {mutation.error instanceof Error ? mutation.error.message : "登録失敗"}
          </p>
        )}

        <div className="mt-4 flex gap-4 pb-2">
          <Button
            className="flex-1"
            variant="secondary"
            onClick={() => navigate("/quest")}
          >
            修正する
          </Button>
          <Button
            className="flex-1"
            variant="success"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            登録する
          </Button>
        </div>
      </div>
    </ChildPageFrame>
  );
}
