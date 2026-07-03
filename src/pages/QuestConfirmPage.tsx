/**
 * @file QuestConfirmPage
 * @description 回答一覧の最終確認と登録。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { postAnswers } from "@/api/client";
import { homeQuery, queryKeys } from "@/api/queries";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { todayLocal } from "@/lib/date";
import {
  isBeforeQuestRegistrationStart,
  isPastQuestRegistrationCutoff,
} from "@/lib/deadline";
import { childAnswerLabel } from "@/lib/labels";
import { getQuestDraft, clearQuestDraft, getBedtimeHourDraft } from "@/lib/sessionStorage";
import { isWeekendEve } from "@/lib/deadline";
import type { BedtimeHour, ChildAnswer, DailyQuests, QuestDefinition, QuestDraft } from "@/types/api";

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
 * 最終確認画面
 * @returns {JSX.Element} ページ
 */
export function QuestConfirmPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const date = todayLocal();
  const { data: daily } = useDailyQuests();
  const { data: homeData, isLoading: isHomeLoading } = useQuery(homeQuery);
  const draft = getQuestDraft(date);
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

  useEffect(() => {
    if (!homeData) return;
    if (homeData.questAction === "none") {
      navigate("/", { replace: true });
      return;
    }
    if (homeData.questAction !== "start") return;
    const bedtimeHour = getBedtimeHourDraft(date) ?? homeData.bedtimeHour ?? 21;
    const now = new Date();
    if (
      isBeforeQuestRegistrationStart(date, now, bedtimeHour) ||
      isPastQuestRegistrationCutoff(date, now, bedtimeHour)
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
      const bedtimeHour: BedtimeHour | undefined = isWeekendEve(date)
        ? (getBedtimeHourDraft(date) ?? homeData?.bedtimeHour ?? 21)
        : undefined;
      return postAnswers({ date, answers, bedtimeHour });
    },
    onSuccess: () => {
      clearQuestDraft(date);
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      navigate("/");
    },
  });

  if (isHomeLoading) {
    return <LoadingScreen />;
  }

  if (!draft || !daily || !confirmationItems || draftError) {
    return (
      <AppLayout>
        <p className="text-danger">
          {draftError ?? "下書きが見つかりません。"}
        </p>
        <Button className="mt-4" onClick={() => navigate("/quest")}>
          クエストに戻る
        </Button>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-app-lg font-bold">
        最後の確認
      </h1>
      <ul className="mb-6 flex flex-col gap-2">
        {confirmationItems.map((item) => (
            <li
              key={item.questId}
              className="flex justify-between rounded-default bg-white px-4 py-3 shadow-sm"
            >
              <span>{item.title}</span>
              <span className="font-medium">
                {childAnswerLabel(item.childAnswer)}
              </span>
            </li>
          ))}
      </ul>
      {mutation.error && (
        <p className="mb-4 text-danger">
          {mutation.error instanceof Error ? mutation.error.message : "登録失敗"}
        </p>
      )}
      <div className="flex flex-col gap-3">
        <Button fullWidth onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          登録する
        </Button>
        <Button fullWidth variant="secondary" onClick={() => navigate("/quest")}>
          修正する
        </Button>
      </div>
    </AppLayout>
  );
}
