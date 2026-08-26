/**
 * @file QuestRulesDialog 描画テスト
 * @description Figma 62:110 の構成（タイトル+✕・要点3カード・アコーディオン4節・閉じる）を検証する。
 * @vitest-environment jsdom
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuestRulesDialog } from "@/components/QuestRulesDialog";

afterEach(cleanup);

describe("QuestRulesDialog", () => {
  it("タイトル・✕・要点3カード・4節・フッタ閉じるを表示する", () => {
    render(
      <QuestRulesDialog open onClose={vi.fn()} isVacationTransition={false} />,
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

    for (const text of [
      "クエストをがんばるとポイントUP",
      "できた +5pt ／ 全達成 +50pt",
      "登録しないとポイントDOWN",
      "未登録 −100pt ／ ウソ −30pt",
      "ポイントでごほうび交換",
      "Switch 30分 = 50pt など",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }

    for (const name of [
      "加点（ポイントが増える）",
      "ペナルティ（ポイントが減る）",
      "ポイント交換",
      "タイマー",
    ]) {
      expect(screen.getByRole("heading", { name })).toBeTruthy();
    }

    // ヘッダー ✕ とフッタ閉じるの2つ
    expect(screen.getAllByRole("button", { name: "閉じる" })).toHaveLength(2);
  });

  it("各節のポイント表と補足を表示する", () => {
    render(
      <QuestRulesDialog open onClose={vi.fn()} isVacationTransition={false} />,
    );

    expect(screen.getByText("できたクエスト 1つにつき")).toBeTruthy();
    expect(screen.getAllByText("+5pt")).toHaveLength(2);
    expect(screen.getByText("+50pt")).toBeTruthy();
    expect(screen.getByText("クエストを登録しなかった日")).toBeTruthy();
    expect(screen.getAllByText("−100pt")).toHaveLength(2);
    expect(screen.getByText("−30pt")).toBeTruthy();
    expect(screen.getByText("Switch 30分券")).toBeTruthy();
    expect(screen.getByText("50pt")).toBeTruthy();
    expect(screen.getByText("100pt")).toBeTruthy();
    expect(
      screen.getByText("交換したいものを選んで申請 → ママが確認"),
    ).toBeTruthy();
    expect(
      screen.getByText("Switch・YouTubeの時間はゲーム・YouTube共通です"),
    ).toBeTruthy();
    expect(screen.getByText("YouTubeだけの交換はありません")).toBeTruthy();
  });

  it("ペナルティチケットの説明を移行期間外でも表示する", () => {
    render(
      <QuestRulesDialog open onClose={vi.fn()} isVacationTransition={false} />,
    );

    expect(
      screen.getByText(
        "負債があるとき、ママがペナルティチケットを発行して精算してくれるよ。チケットは手伝いのご褒美だよ。",
      ),
    ).toBeTruthy();
  });

  it("ヘッダーの ✕ で onClose を呼ぶ", () => {
    const onClose = vi.fn();
    render(
      <QuestRulesDialog
        open
        onClose={onClose}
        isVacationTransition={false}
      />,
    );

    const closeX = screen
      .getAllByRole("button", { name: "閉じる" })
      .find((button) => button.textContent === "✕");
    expect(closeX).toBeTruthy();
    fireEvent.click(closeX as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
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
