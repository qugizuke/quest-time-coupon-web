/**
 * @file モック API の単体テスト
 * @description 受付開始・締切チェックと retry 保存の挙動を検証する。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "./mock";
import type { ChildAnswer } from "@/types/api";

const sampleAnswers: { questId: string; childAnswer: ChildAnswer }[] = [
  { questId: "bedtime-prep", childAnswer: 1 },
  { questId: "sleep-on-time-yesterday", childAnswer: 1 },
  { questId: "brush-teeth-gargle-am", childAnswer: 1 },
  { questId: "wash-hands-gargle-after-school", childAnswer: 1 },
  { questId: "save-water-hot-water", childAnswer: 1 },
  { questId: "listen-to-mama-before-warning", childAnswer: 1 },
];

describe("mockApi answers 受付タイミング", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("新規登録は締切後に拒否される", async () => {
    const date = "2026-06-07";
    vi.setSystemTime(new Date(2026, 5, 7, 21, 30, 0));

    await expect(
      mockApi("answers", {
        method: "POST",
        body: JSON.stringify({ date, answers: sampleAnswers, bedtimeHour: 21 }),
      }),
    ).rejects.toThrow("登録受付締切を過ぎているため回答を保存できません");
  });

  it("既存回答の retry は締切後も保存できる", async () => {
    const date = "2026-06-07-retry";
    vi.setSystemTime(new Date(2026, 5, 7, 20, 30, 0));

    await mockApi("answers", {
      method: "POST",
      body: JSON.stringify({ date, answers: sampleAnswers, bedtimeHour: 21 }),
    });

    vi.setSystemTime(new Date(2026, 5, 7, 21, 30, 0));

    const result = await mockApi<{ submittedAt: string; overwritten: boolean }>("answers", {
      method: "POST",
      body: JSON.stringify({
        date,
        answers: sampleAnswers.map((answer) =>
          answer.questId === "sleep-on-time-yesterday"
            ? { ...answer, childAnswer: 0 as const }
            : answer,
        ),
        bedtimeHour: 21,
      }),
    });

    expect(result.overwritten).toBe(true);
  });

  it("回答済みの登録ゲートは retry で変更できない", async () => {
    const date = "2026-06-14";
    vi.setSystemTime(new Date(2026, 5, 14, 20, 30, 0));

    await mockApi("answers", {
      method: "POST",
      body: JSON.stringify({ date, answers: sampleAnswers, bedtimeHour: 21 }),
    });

    vi.setSystemTime(new Date(2026, 5, 14, 21, 30, 0));

    await expect(
      mockApi("answers", {
        method: "POST",
        body: JSON.stringify({
          date,
          answers: sampleAnswers.map((answer) =>
            answer.questId === "bedtime-prep"
              ? { ...answer, childAnswer: 0 as const }
              : answer,
          ),
          bedtimeHour: 21,
        }),
      }),
    ).rejects.toThrow("回答済みの登録ゲートは変更できません");
  });

  it("retry では保存済み bedtime を上書きしない", async () => {
    const date = "2026-06-20";
    vi.setSystemTime(new Date(2026, 5, 20, 20, 30, 0));

    await mockApi("answers", {
      method: "POST",
      body: JSON.stringify({ date, answers: sampleAnswers, bedtimeHour: 21 }),
    });

    await mockApi("answers", {
      method: "POST",
      body: JSON.stringify({
        date,
        answers: sampleAnswers.map((answer) =>
          answer.questId === "sleep-on-time-yesterday"
            ? { ...answer, childAnswer: 0 as const }
            : answer,
        ),
        bedtimeHour: 23,
      }),
    });

    const home = await mockApi<{ bedtimeHour: number }>("home", undefined, { date });
    expect(home.bedtimeHour).toBe(21);
  });
});

describe("mockApi registrationSetting 競合ガード", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("回答後は就寝時刻を変更できない", async () => {
    const date = "2026-06-06";
    vi.setSystemTime(new Date(2026, 5, 6, 20, 30, 0));

    await mockApi("answers", {
      method: "POST",
      body: JSON.stringify({ date, answers: sampleAnswers, bedtimeHour: 21 }),
    });

    await expect(
      mockApi("registrationSetting", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 23 }),
      }),
    ).rejects.toThrow("回答後は就寝時刻を変更できません");
  });

  it("現在の締切を過ぎた後に遅い bedtime へ延長できない", async () => {
    const date = "2026-06-13";
    vi.setSystemTime(new Date(2026, 5, 13, 20, 30, 0));

    await mockApi("registrationSetting", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 21 }),
    });

    vi.setSystemTime(new Date(2026, 5, 13, 21, 30, 0));

    await expect(
      mockApi("registrationSetting", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 23 }),
      }),
    ).rejects.toThrow("登録受付締切を過ぎているため設定できません");
  });

  it("変更先の締切を過ぎた早い bedtime へ変更できない", async () => {
    const date = "2026-06-13";
    vi.setSystemTime(new Date(2026, 5, 13, 20, 30, 0));

    await mockApi("registrationSetting", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 23 }),
    });

    vi.setSystemTime(new Date(2026, 5, 13, 21, 30, 0));

    await expect(
      mockApi("registrationSetting", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 21 }),
      }),
    ).rejects.toThrow("変更先の登録受付締切を過ぎているため設定できません");
  });
});
