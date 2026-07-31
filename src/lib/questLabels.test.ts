import { describe, expect, it } from "vitest";
import {
  HOMEWORK_QUEST_ID,
  PHONE_QUEST_ID,
  isSkipAnswerQuest,
  resolveQuestTitle,
} from "./questLabels";
import { childAnswerLabel } from "./labels";
import type { DailyQuests } from "@/types/api";

const daily: DailyQuests = {
  date: "2026-07-30",
  version: 2,
  generationMode: "fixed_seed",
  quests: [
    {
      id: "homework-done-today",
      order: 5,
      category: "routine",
      title: "今日は宿題をやりましたか？",
      conditional: {
        gateAnswerMode: "yesNo",
        followUpWhen: 1,
        followUpTitle: "宿題はテキパキとできましたか？",
        persistGateAnswer: false,
      },
    },
  ],
};

describe("resolveQuestTitle", () => {
  it("現在のクエスト定義にある ID は現在のタイトルを返す", () => {
    expect(resolveQuestTitle(daily, "homework-done-today")).toBe(
      "今日は宿題をやりましたか？",
    );
  });

  it("旧 homework は旧質問文を返す", () => {
    expect(resolveQuestTitle(daily, "homework")).toBe("宿題をテキパキとやった");
  });

  it("採点画面用に追問タイトルを返す", () => {
    expect(
      resolveQuestTitle(daily, "homework-done-today", {
        preferFollowUpTitle: true,
      }),
    ).toBe("宿題はテキパキとできましたか？");
  });

  it("廃止済み brush-teeth-pm は旧質問文を返す", () => {
    expect(resolveQuestTitle(daily, "brush-teeth-pm")).toBe(
      "夜の歯みがきをした",
    );
  });

  it("旧 reminder ID は旧質問文を返す", () => {
    expect(resolveQuestTitle(daily, "save-water")).toBe(
      "水とお湯の無駄づかいをしない",
    );
    expect(resolveQuestTitle(daily, "listen-to-mama")).toBe(
      "ママの話をちゃんときく",
    );
  });

  it("旧 ID は現在定義よりも旧質問文を優先して返す", () => {
    const mixedDaily: DailyQuests = {
      date: "2026-07-30",
      version: 2,
      generationMode: "fixed_seed",
      quests: [
        {
          id: "brush-teeth-am",
          order: 3,
          title: "朝は歯磨きとうがいをしましたか？",
        },
      ],
    };

    expect(resolveQuestTitle(mixedDaily, "brush-teeth-am")).toBe(
      "朝の歯みがきをした",
    );
  });
});


describe("isSkipAnswerQuest", () => {
  it("gradingMode=skip のときのみスキップ扱い", () => {
    expect(isSkipAnswerQuest(HOMEWORK_QUEST_ID, "skip")).toBe(true);
    expect(isSkipAnswerQuest(PHONE_QUEST_ID, "skip")).toBe(true);
  });

  it("旧履歴の homework -1（auto_worst）はスキップ扱いにしない", () => {
    expect(isSkipAnswerQuest(HOMEWORK_QUEST_ID, "auto_worst")).toBe(false);
    expect(isSkipAnswerQuest("homework", "auto_worst")).toBe(false);
  });

  it("gradingMode 未指定時は questId だけで skip にしない", () => {
    expect(isSkipAnswerQuest(HOMEWORK_QUEST_ID)).toBe(false);
  });
});

describe("childAnswerLabel gradingMode", () => {
  it("skip 以外の -1 は分からない", () => {
    expect(
      childAnswerLabel(-1, "default", HOMEWORK_QUEST_ID, "auto_worst"),
    ).toBe("分からない");
  });

  it("skip の -1 は宿題なし文言", () => {
    expect(
      childAnswerLabel(-1, "default", HOMEWORK_QUEST_ID, "skip"),
    ).toBe("今日は宿題がなかった");
  });
});
