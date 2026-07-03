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
});
