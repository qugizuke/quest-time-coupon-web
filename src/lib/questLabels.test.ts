import { describe, expect, it } from "vitest";
import { resolveQuestTitle } from "./questLabels";
import type { DailyQuests } from "@/types/api";

const daily: DailyQuests = {
  version: 2,
  quests: [
    {
      id: "homework-done-today",
      order: 5,
      category: "routine",
      title: "今日は宿題をやりましたか？",
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
      version: 2,
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
