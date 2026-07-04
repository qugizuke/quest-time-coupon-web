/**
 * @file useQuestDraft tests
 * @description 条件分岐クエストの下書き遷移を検証する。
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useQuestDraft } from "./useQuestDraft";
import type { DailyQuests } from "@/types/api";

const daily: DailyQuests = {
  version: 2,
  quests: [
    {
      id: "homework-done-today",
      order: 1,
      category: "routine",
      scoringRole: "conditional",
      title: "今日は宿題をやりましたか？",
      conditional: {
        gateAnswerMode: "yesNo",
        followUpWhen: 1,
        followUpTitle: "宿題はテキパキとできましたか？",
        persistGateAnswer: false,
      },
    },
    {
      id: "save-water-hot-water",
      order: 2,
      category: "reminder",
      scoringRole: "standard",
      title: "水やお湯の無駄遣いをしませんでしたか？",
    },
  ],
};

describe("useQuestDraft", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("非保存ゲートで追問に回答したら次のクエストへ進む", async () => {
    const { result } = renderHook(() => useQuestDraft("2026-06-07", daily));

    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.setAnswer(1);
    });
    expect(result.current.isFollowUpMode).toBe(true);
    expect(result.current.currentQuest?.title).toBe("宿題はテキパキとできましたか？");

    act(() => {
      result.current.setAnswer(1);
    });
    expect(result.current.isFollowUpMode).toBe(false);
    expect(result.current.draft.index).toBe(1);
    expect(result.current.currentQuest?.id).toBe("save-water-hot-water");
    expect(result.current.currentQuest?.title).toBe("水やお湯の無駄遣いをしませんでしたか？");
  });

  it("非保存ゲートで追問が必要な場合、追問未回答のまま次へ進めない", async () => {
    const { result } = renderHook(() => useQuestDraft("2026-06-07", daily));

    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => {
      result.current.setAnswer(1);
    });
    expect(result.current.isFollowUpMode).toBe(true);

    act(() => {
      result.current.goPrev();
    });
    expect(result.current.isFollowUpMode).toBe(false);
    expect(result.current.currentAnswer).toBe(1);
    expect(result.current.canGoNext).toBe(false);
  });

  it("追問回答後に下書きを復元しても次のクエスト位置を維持する", async () => {
    const firstRender = renderHook(() => useQuestDraft("2026-06-07", daily));

    await waitFor(() => expect(firstRender.result.current.ready).toBe(true));

    act(() => {
      firstRender.result.current.setAnswer(1);
    });
    act(() => {
      firstRender.result.current.setAnswer(0);
    });
    expect(firstRender.result.current.draft.index).toBe(1);

    firstRender.unmount();

    const restoredRender = renderHook(() => useQuestDraft("2026-06-07", daily));

    await waitFor(() => expect(restoredRender.result.current.ready).toBe(true));

    expect(restoredRender.result.current.isFollowUpMode).toBe(false);
    expect(restoredRender.result.current.draft.index).toBe(1);
    expect(restoredRender.result.current.currentQuest?.id).toBe("save-water-hot-water");
    expect(
      restoredRender.result.current.draft.gateAnswers?.["homework-done-today"],
    ).toBe(1);
    expect(
      restoredRender.result.current.draft.answers.find(
        (answer) => answer.questId === "homework-done-today",
      )?.childAnswer,
    ).toBe(0);
  });
});
