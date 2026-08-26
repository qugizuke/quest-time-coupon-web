/**
 * @file QuestRulesDialog 描画テスト
 * @description §8.7 の構成と条件付き移行期間メッセージを検証する。
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestRulesDialog } from "@/components/QuestRulesDialog";

afterEach(cleanup);

describe("QuestRulesDialog", () => {
  it("§8.7 のタイトル、要点カード、4つの節を表示する", () => {
    render(
      <QuestRulesDialog
        open
        onClose={vi.fn()}
        isVacationTransition={false}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "クエストのルール" }),
    ).toBeTruthy();
    expect(screen.getByTestId("quest-rules-highlight")).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: "まず覚えよう！ 3つの大事なこと",
      }),
    ).toBeTruthy();

    for (const name of [
      "加点（ポイントが増える）",
      "ペナルティ（ポイントが減る）",
      "ポイント交換",
      "タイマー",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }
  });

  it("ペナルティチケットの説明を移行期間外でも表示する", () => {
    render(
      <QuestRulesDialog
        open
        onClose={vi.fn()}
        isVacationTransition={false}
      />,
    );

    expect(
      screen.getByText(
        "負債があるとき、ママがペナルティチケットを発行して精算してくれるよ。チケットは手伝いのご褒美だよ。",
      ),
    ).toBeTruthy();
  });

  it("長期休み終了前の説明は移行期間中だけ表示する", () => {
    const { rerender } = render(
      <QuestRulesDialog
        open
        onClose={vi.fn()}
        isVacationTransition={false}
      />,
    );

    expect(
      screen.queryByTestId("quest-rules-vacation-transition"),
    ).toBeNull();

    rerender(
      <QuestRulesDialog open onClose={vi.fn()} isVacationTransition />,
    );

    expect(screen.getByTestId("quest-rules-vacation-transition")).toBeTruthy();
    expect(
      screen.getByText(
        "長期休みが終わる1週間前から、寝る時間は21時に決まるよ。起きる時間も少し早くなるよ。",
      ),
    ).toBeTruthy();
  });
});
