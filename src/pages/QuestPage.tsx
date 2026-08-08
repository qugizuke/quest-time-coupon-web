/**
 * @file QuestPage
 * @description 1問ずつクエストに回答する画面（宿題条件分岐対応）。
 *   見た目は Figma kid-quest（進捗バー・色付き3択・茶枠ボード）に寄せる（Issue #19）。
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import type { ChildAnswer, QuestDefinition } from "@/types/api";
import { homeQuery } from "@/api/queries";
import { ChildPageFrame } from "@/components/layout/ChildPageFrame";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { useQuestDraft } from "@/hooks/useQuestDraft";
import { todayLocal } from "@/lib/date";
import {
  isBeforeQuestRegistrationStart,
  isPastQuestRegistrationCutoff,
} from "@/lib/deadline";
import { isRegistrationReopenActive } from "@/lib/registrationReopen";
import { HOMEWORK_QUEST_ID, PHONE_QUEST_ID } from "@/lib/questLabels";
import { ensureQuestSessionStarted, getBedtimeHourDraft } from "@/lib/sessionStorage";

/**
 * 選択肢の見た目メタ
 * @typedef {object} ChoiceMeta
 * @property {ChildAnswer} value - 回答値
 * @property {string} label - 表示ラベル
 * @property {string} idleClass - 未選択クラス
 * @property {string} selectedClass - 選択中クラス
 */
type ChoiceMeta = {
  value: ChildAnswer;
  label: string;
  idleClass: string;
  selectedClass: string;
};

/** 3択クエスト用の選択肢（Figma 色） */
const CHOICES: ChoiceMeta[] = [
  {
    value: 1,
    label: "👍 できた",
    idleClass: "border-success bg-success-soft",
    selectedClass: "border-success bg-success text-white shadow-[var(--shadow-secondary)]",
  },
  {
    value: 0,
    label: "👎 できなかった",
    idleClass: "border-danger bg-danger-soft",
    selectedClass: "border-danger bg-danger text-white shadow-[var(--shadow-danger)]",
  },
  {
    value: -1,
    label: "🤔 わからない",
    idleClass: "border-primary bg-surface-warm",
    selectedClass: "border-primary bg-primary text-white shadow-[var(--shadow-primary)]",
  },
];

/** 2択クエスト用の選択肢 */
const BINARY_CHOICES: ChoiceMeta[] = [
  CHOICES[0],
  CHOICES[1],
];

/** #6 宿題専用3択（テキパキできた／できなかった／宿題がなかった） */
const HOMEWORK_CHOICES: ChoiceMeta[] = [
  {
    value: 1,
    label: "👍 テキパキできた",
    idleClass: "border-success bg-success-soft",
    selectedClass: "border-success bg-success text-white shadow-[var(--shadow-secondary)]",
  },
  {
    value: 0,
    label: "👎 テキパキできなかった",
    idleClass: "border-danger bg-danger-soft",
    selectedClass: "border-danger bg-danger text-white shadow-[var(--shadow-danger)]",
  },
  {
    value: -1,
    label: "📚 今日は宿題がなかった",
    idleClass: "border-primary bg-surface-warm",
    selectedClass: "border-primary bg-primary text-white shadow-[var(--shadow-primary)]",
  },
];

/** #7 キッズケータイ専用3択（できた／できなかった／使う必要がなかった・Issue #29） */
const PHONE_CHOICES: ChoiceMeta[] = [
  {
    value: 1,
    label: "👍 できた",
    idleClass: "border-success bg-success-soft",
    selectedClass: "border-success bg-success text-white shadow-[var(--shadow-secondary)]",
  },
  {
    value: 0,
    label: "👎 できなかった",
    idleClass: "border-danger bg-danger-soft",
    selectedClass: "border-danger bg-danger text-white shadow-[var(--shadow-danger)]",
  },
  {
    value: -1,
    label: "📱 今日はキッズケータイを使う必要がなかった",
    idleClass: "border-primary bg-surface-warm",
    selectedClass: "border-primary bg-primary text-white shadow-[var(--shadow-primary)]",
  },
];

/** はい / いいえゲート用の選択肢 */
const YES_NO_CHOICES: ChoiceMeta[] = [
  {
    value: 1,
    label: "👍 はい",
    idleClass: "border-success bg-success-soft",
    selectedClass: "border-success bg-success text-white",
  },
  {
    value: 0,
    label: "👎 いいえ",
    idleClass: "border-danger bg-danger-soft",
    selectedClass: "border-danger bg-danger text-white",
  },
];

/**
 * 現在のクエストに表示する選択肢を返す
 * @param {QuestDefinition} quest - 表示中のクエスト
 * @param {boolean} isFollowUpMode - 追問表示中か
 * @returns {ChoiceMeta[]} 選択肢一覧
 */
function answerChoicesFor(
  quest: QuestDefinition,
  isFollowUpMode: boolean,
): ChoiceMeta[] {
  if (isFollowUpMode) return CHOICES;
  if (quest.conditional?.gateAnswerMode === "yesNo") return YES_NO_CHOICES;
  if (quest.answerMode === "binary") return BINARY_CHOICES;
  if (quest.id === HOMEWORK_QUEST_ID) return HOMEWORK_CHOICES;
  if (quest.id === PHONE_QUEST_ID) return PHONE_CHOICES;
  return CHOICES;
}

/**
 * クエスト回答画面
 * @returns {JSX.Element} ページ
 */
export function QuestPage() {
  const navigate = useNavigate();
  const date = todayLocal();
  const { data: homeData } = useQuery(homeQuery);
  const { data: daily, isLoading } = useDailyQuests();
  const {
    draft,
    ready,
    setAnswer,
    goNext,
    goPrev,
    isComplete,
    currentQuest,
    currentAnswer,
    isFollowUpMode,
    canGoNext,
    canConfirm,
  } = useQuestDraft(date, daily);

  useEffect(() => {
    ensureQuestSessionStarted(date);
  }, [date]);

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

  if (isLoading || !daily || !ready || !currentQuest) {
    return (
      <ChildPageFrame vacationMode={homeData?.isVacationMode}>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-muted">読み込み中…</p>
        </div>
      </ChildPageFrame>
    );
  }

  const choices = answerChoicesFor(currentQuest, isFollowUpMode);
  const progressIndex = isFollowUpMode ? draft.index + 1 : draft.index + 1;
  const progressTotal = daily.quests.length;
  const progressRatio = progressTotal > 0 ? progressIndex / progressTotal : 0;

  return (
    <ChildPageFrame vacationMode={homeData?.isVacationMode}>
      <div className="flex flex-1 flex-col gap-6 transition-opacity duration-300">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">
              {isFollowUpMode ? "追問" : "まいにちクエスト"}
            </span>
            <span className="text-info">
              {isFollowUpMode
                ? "追問"
                : `${progressIndex} / ${progressTotal}`}
            </span>
          </div>
          {!isFollowUpMode && (
            <div
              className="h-4 overflow-hidden rounded-sm border-2 border-border bg-progress-track"
              role="progressbar"
              aria-valuenow={progressIndex}
              aria-valuemin={1}
              aria-valuemax={progressTotal}
            >
              <div
                className="h-full bg-info transition-[width] duration-300"
                style={{ width: `${Math.round(progressRatio * 100)}%` }}
              />
            </div>
          )}
        </div>

        <Card className="flex flex-1 flex-col items-center gap-8 border-4 p-8 text-center shadow-[var(--shadow-quest-board)] sm:p-12">
          <h1 className="text-2xl font-bold leading-relaxed text-ink sm:text-[32px]">
            {currentQuest.title}
          </h1>
          {currentQuest.hint && (
            <p className="text-muted">{currentQuest.hint}</p>
          )}

          <div
            className={[
              "flex w-full gap-3",
              choices.length >= 3
                ? "flex-col sm:flex-row"
                : "flex-col sm:flex-row",
            ].join(" ")}
          >
            {choices.map((c) => {
              const selected = currentAnswer === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setAnswer(c.value)}
                  className={[
                    "flex min-h-[72px] flex-1 items-center justify-center rounded-[20px] border-4 px-4 py-6 text-lg font-medium text-ink transition-transform active:scale-[0.98] sm:min-h-[120px] sm:text-[22px]",
                    selected ? c.selectedClass : c.idleClass,
                  ].join(" ")}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </Card>

        <div className="flex gap-3">
          <Button
            className="flex-1"
            variant="secondary"
            disabled={draft.index === 0 && !isFollowUpMode}
            onClick={goPrev}
          >
            👈 もどる
          </Button>
          {canGoNext ? (
            <Button className="flex-1" onClick={goNext}>
              つぎへ 👉
            </Button>
          ) : (
            <Button
              className="flex-1"
              disabled={!canConfirm && !isComplete}
              onClick={() => navigate("/quest/confirm")}
            >
              確認へ 👉
            </Button>
          )}
        </div>
      </div>
    </ChildPageFrame>
  );
}
