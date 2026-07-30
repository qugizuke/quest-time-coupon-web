/**
 * @file モック API の単体テスト
 * @description 受付開始・締切チェックと retry 保存の挙動を検証する。
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearMockHomeModeFlags, mockApi, resetMockStore, setMockHomeModeFlags } from "./mock";
import { clearParentLocalSettings } from "@/lib/parentLocalSettings";
import type { ChildAnswer, HomeData } from "@/types/api";

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
    clearMockHomeModeFlags();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearMockHomeModeFlags();
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

  it("休日前夜の未選択は21時台でも未登録ペナルティにならない", async () => {
    vi.setSystemTime(new Date(2026, 6, 24, 21, 30, 0));

    const home = await mockApi<{ todayStatus: string; questAction: string }>("home");

    expect(home.todayStatus).toBe("unanswered");
    expect(home.questAction).toBe("start");
  });

  it("休日前夜の未選択は22時台なら新規登録できる", async () => {
    const date = "2026-07-03";
    vi.setSystemTime(new Date(2026, 6, 3, 22, 30, 0));

    const result = await mockApi<{ submittedAt: string; overwritten: boolean }>("answers", {
      method: "POST",
      body: JSON.stringify({ date, answers: sampleAnswers }),
    });

    expect(result.overwritten).toBe(false);
  });

  it("休日前夜の未選択は23時超で新規登録を拒否する", async () => {
    const date = "2026-07-10";
    vi.setSystemTime(new Date(2026, 6, 10, 23, 0, 1));

    await expect(
      mockApi("answers", {
        method: "POST",
        body: JSON.stringify({ date, answers: sampleAnswers }),
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

  it("回答済みの条件付きクエストは retry で削除できる", async () => {
    const date = "2026-06-22";
    vi.setSystemTime(new Date(2026, 5, 22, 20, 30, 0));

    await mockApi("answers", {
      method: "POST",
      body: JSON.stringify({
        date,
        answers: [
          ...sampleAnswers,
          { questId: "homework-done-today", childAnswer: 1 as const },
        ],
        bedtimeHour: 21,
      }),
    });

    const result = await mockApi<{ submittedAt: string; overwritten: boolean }>("answers", {
      method: "POST",
      body: JSON.stringify({
        date,
        answers: sampleAnswers,
        bedtimeHour: 21,
      }),
    });

    expect(result.overwritten).toBe(true);
  });
});

describe("mockApi registrationSetting 競合ガード", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearMockHomeModeFlags();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearMockHomeModeFlags();
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
        body: JSON.stringify({ date, bedtimeHour: 23, actor: "child"}),
      }),
    ).rejects.toThrow("回答後は就寝時刻を変更できません");
  });

  it("現在の締切を過ぎた後に遅い bedtime へ延長できない", async () => {
    const date = "2026-06-13";
    vi.setSystemTime(new Date(2026, 5, 13, 20, 30, 0));

    await mockApi("registrationSetting", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 21, actor: "child"}),
    });

    vi.setSystemTime(new Date(2026, 5, 13, 21, 30, 0));

    await expect(
      mockApi("registrationSetting", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 23, actor: "child"}),
      }),
    ).rejects.toThrow("登録受付締切を過ぎているため設定できません");
  });

  it("変更先の締切を過ぎた早い bedtime へ変更できない", async () => {
    const date = "2026-06-13";
    vi.setSystemTime(new Date(2026, 5, 13, 20, 30, 0));

    await mockApi("registrationSetting", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 23, actor: "child"}),
    });

    vi.setSystemTime(new Date(2026, 5, 13, 21, 30, 0));

    await expect(
      mockApi("registrationSetting", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 21, actor: "child"}),
      }),
    ).rejects.toThrow("変更先の登録受付締切を過ぎているため設定できません");
  });

  it("休日前夜で未選択なら21時台でも就寝時刻を設定できる", async () => {
    const date = "2026-07-17";
    vi.setSystemTime(new Date(2026, 6, 17, 21, 30, 0));

    const result = await mockApi<{ date: string; bedtimeHour: number }>("registrationSetting", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 22, actor: "child" }),
    });

    expect(result.bedtimeHour).toBe(22);
  });

  it("平日は21時指定でも registrationSetting を受け付けない", async () => {
    const date = "2026-07-01";
    vi.setSystemTime(new Date(2026, 6, 1, 20, 30, 0));

    await expect(
      mockApi("registrationSetting", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 21, actor: "child"}),
      }),
    ).rejects.toThrow(
      "休日前日または長期休み（正午まで）のみ bedtimeHour を設定できます",
    );
  });
});

describe("mockApi home 免除・長期休み", () => {
  beforeEach(() => {
    resetMockStore();
  });

  afterEach(() => {
    resetMockStore();
  });

  it("免除日は questAction=none と isExemptDay=true", async () => {
    setMockHomeModeFlags({ exemptDates: ["2026-07-30"] });
    const home = await mockApi<HomeData>("home", undefined, { date: "2026-07-30" });
    expect(home.isExemptToday).toBe(true);
    expect(home.isExemptDay).toBe(true);
    expect(home.todayStatus).toBe("exempt");
    expect(home.questAction).toBe("none");
    expect(home.isVacationMode).toBe(false);
  });

  it("長期休みフラグを返す", async () => {
    setMockHomeModeFlags({ vacationMode: true });
    const home = await mockApi<HomeData>("home", undefined, { date: "2026-07-28" });
    expect(home.isVacationMode).toBe(true);
    expect(home.isExemptDay).toBe(false);
  });

  it("長期休み中は平日でも就寝設定を受け付ける（正午まで）", async () => {
    vi.useFakeTimers();
    const date = "2026-08-11"; // 火曜・他テストと日付衝突しない
    vi.setSystemTime(new Date(2026, 7, 11, 10, 0, 0));
    setMockHomeModeFlags({ vacationMode: true });

    const result = await mockApi<{ bedtimeHour: number }>("registrationSetting", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 22, actor: "child" }),
    });
    expect(result.bedtimeHour).toBe(22);
    vi.useRealTimers();
  });

  it("免除日は回答登録できない", async () => {
    setMockHomeModeFlags({ exemptDates: ["2026-07-30"] });
    await expect(
      mockApi("answers", {
        method: "POST",
        body: JSON.stringify({
          date: "2026-07-30",
          answers: sampleAnswers,
        }),
      }),
    ).rejects.toThrow("FORBIDDEN_STATE: 免除日は回答を登録できません");
  });

  it("締切超過後に免除へ切り替えると未確認ブロックが解除される", async () => {
    vi.useFakeTimers();
    const date = "2026-07-01"; // 水曜・平日通常日
    vi.setSystemTime(new Date(2026, 6, 1, 21, 30, 0));

    const before = await mockApi<HomeData>("home", undefined, { date });
    expect(before.unacknowledgedCount).toBeGreaterThan(0);
    // unregistered は timerBlock 対象外（契約 §2.4）
    expect(before.timerBlockCount).toBe(0);
    expect(before.canStartTimer).toBe(true);

    setMockHomeModeFlags({ exemptDates: [date] });
    const after = await mockApi<HomeData>("home", undefined, { date });
    expect(after.isExemptDay).toBe(true);
    expect(after.unacknowledgedCount).toBe(0);
    expect(after.canStartTimer).toBe(true);

    vi.useRealTimers();
  });
});

describe("mockApi grade 否定・わからない混在", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearMockHomeModeFlags();
    clearParentLocalSettings();
    resetMockStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearMockHomeModeFlags();
    clearParentLocalSettings();
    resetMockStore();
  });

  it("否定・わからないを含む日でも肯定分のみの POST で採点できる", async () => {
    const date = "2026-06-08";
    vi.setSystemTime(new Date(2026, 5, 8, 20, 30, 0));

    const mixedAnswers: { questId: string; childAnswer: ChildAnswer }[] = [
      { questId: "bedtime-prep", childAnswer: 1 },
      { questId: "sleep-on-time-yesterday", childAnswer: 0 },
      { questId: "brush-teeth-gargle-am", childAnswer: -1 },
      { questId: "wash-hands-gargle-after-school", childAnswer: 1 },
      { questId: "save-water-hot-water", childAnswer: 1 },
      { questId: "listen-to-mama-before-warning", childAnswer: 1 },
    ];

    await mockApi("answers", {
      method: "POST",
      body: JSON.stringify({ date, answers: mixedAnswers, bedtimeHour: 21 }),
    });

    const graded = await mockApi<{ gradedAt: string }>("grade", {
      method: "POST",
      body: JSON.stringify({
        date,
        grades: [
          { questId: "bedtime-prep", actualDone: true },
          { questId: "wash-hands-gargle-after-school", actualDone: true },
          { questId: "save-water-hot-water", actualDone: false },
          { questId: "listen-to-mama-before-warning", actualDone: true },
        ],
      }),
    });
    expect(graded.gradedAt).toBeTruthy();

    const detail = await mockApi<{
      items: { questId: string; actualDone: boolean | null }[];
    }>("grade", undefined, { date });
    const byId = new Map(detail.items.map((item) => [item.questId, item.actualDone]));
    expect(byId.get("sleep-on-time-yesterday")).toBe(false);
    expect(byId.get("brush-teeth-gargle-am")).toBeNull();
    expect(byId.get("save-water-hot-water")).toBe(false);
  });

  it("否定回答を payload に含めると BAD_REQUEST", async () => {
    const date = "2026-06-09";
    vi.setSystemTime(new Date(2026, 5, 9, 20, 30, 0));

    await mockApi("answers", {
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

    await expect(
      mockApi("grade", {
        method: "POST",
        body: JSON.stringify({
          date,
          grades: [
            { questId: "bedtime-prep", actualDone: true },
            { questId: "sleep-on-time-yesterday", actualDone: false },
            { questId: "brush-teeth-gargle-am", actualDone: true },
            { questId: "wash-hands-gargle-after-school", actualDone: true },
            { questId: "save-water-hot-water", actualDone: true },
            { questId: "listen-to-mama-before-warning", actualDone: true },
          ],
        }),
      }),
    ).rejects.toThrow("肯定回答以外は採点不要");
  });
});

describe("mockApi parentBedtime 制約", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearMockHomeModeFlags();
    clearParentLocalSettings();
    resetMockStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearMockHomeModeFlags();
    clearParentLocalSettings();
    resetMockStore();
  });

  it("長期休み・正午以降なら就寝を変更できる", async () => {
    const date = "2026-08-11";
    vi.setSystemTime(new Date(2026, 7, 11, 13, 0, 0));
    setMockHomeModeFlags({ vacationMode: true });

    const saved = await mockApi<{ bedtimeHour: number }>("parentBedtime", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 22 }),
    });
    expect(saved.bedtimeHour).toBe(22);
  });

  it("免除日は拒否する", async () => {
    const date = "2026-08-11";
    vi.setSystemTime(new Date(2026, 7, 11, 13, 0, 0));
    setMockHomeModeFlags({ vacationMode: true, exemptDates: [date] });

    await expect(
      mockApi("parentBedtime", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 22 }),
      }),
    ).rejects.toThrow("免除日");
  });

  it("回答提出後は拒否する", async () => {
    const date = "2026-08-11";
    vi.setSystemTime(new Date(2026, 7, 11, 13, 0, 0));
    setMockHomeModeFlags({ vacationMode: true });

    await mockApi("parentBedtime", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 23 }),
    });

    vi.setSystemTime(new Date(2026, 7, 11, 22, 15, 0));
    await mockApi("answers", {
      method: "POST",
      body: JSON.stringify({ date, answers: sampleAnswers }),
    });

    await expect(
      mockApi("parentBedtime", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 22 }),
      }),
    ).rejects.toThrow("回答提出後");
  });

  it("就寝1時間前以降は拒否する", async () => {
    const date = "2026-08-11";
    vi.setSystemTime(new Date(2026, 7, 11, 20, 0, 0));
    setMockHomeModeFlags({ vacationMode: true });

    await expect(
      mockApi("parentBedtime", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 21 }),
      }),
    ).rejects.toThrow("就寝1時間前");
  });
});

describe("mockApi registrationReopen リロード耐性", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearMockHomeModeFlags();
    clearParentLocalSettings();
    resetMockStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearMockHomeModeFlags();
    clearParentLocalSettings();
    resetMockStore();
  });

  it("再開後にメモリストアを消しても localStorage から復元して回答できる", async () => {
    const date = "2026-06-07";
    vi.setSystemTime(new Date(2026, 5, 7, 21, 30, 0));

    await mockApi("registrationReopen", {
      method: "POST",
      body: JSON.stringify({
        date,
        until: new Date(2026, 5, 7, 22, 30, 0).toISOString(),
      }),
    });

    // リロード相当: メモリ上の再開枠だけ消す（localStorage は残す）
    resetMockStore();
    vi.setSystemTime(new Date(2026, 5, 7, 21, 45, 0));

    const result = await mockApi<{ submittedAt: string }>("answers", {
      method: "POST",
      body: JSON.stringify({ date, answers: sampleAnswers, bedtimeHour: 21 }),
    });
    expect(result.submittedAt).toBeTruthy();
  });
});
