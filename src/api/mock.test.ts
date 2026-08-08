/**
 * @file モック API の単体テスト
 * @description 受付開始・締切チェックと retry 保存の挙動を検証する。
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearMockHomeModeFlags,
  getMockWakeUp,
  mockApi,
  resetMockStore,
  setMockHomeModeFlags,
} from "./mock";
import {
  clearParentLocalSettings,
  MOCK_EXEMPT_FLAG_KEY,
} from "@/lib/parentLocalSettings";
import type { ChildAnswer, DailyQuests, HomeData } from "@/types/api";

/** to-be 10問（api-tobe-f-contract.md §4.1）に一致するサンプル回答（全問肯定） */
const sampleAnswers: { questId: string; childAnswer: ChildAnswer }[] = [
  { questId: "bedtime-prep", childAnswer: 1 },
  { questId: "sleep-on-time-yesterday", childAnswer: 1 },
  { questId: "wake-on-time", childAnswer: 1 },
  { questId: "brush-teeth-gargle-am", childAnswer: 1 },
  { questId: "wash-hands-gargle-after-school", childAnswer: 1 },
  { questId: "homework-done-today", childAnswer: 1 },
  { questId: "phone-non-emergency-unused", childAnswer: 1 },
  { questId: "save-water-hot-water", childAnswer: 1 },
  { questId: "no-repeated-warnings", childAnswer: 1 },
  { questId: "listen-to-mama-before-warning", childAnswer: 1 },
];

describe("mockApi dailyQuests クエストマスタ（Issue #33）", () => {
  it("date クエリで10問のクエスト定義を返す", async () => {
    const data = await mockApi<DailyQuests>("dailyQuests", undefined, {
      date: "2026-07-30",
    });

    expect(data.date).toBe("2026-07-30");
    expect(data.generationMode).toBe("fixed_seed");
    expect(data.quests).toHaveLength(10);
    expect(data.quests.map((q) => q.id)).toEqual(sampleAnswers.map((a) => a.questId));
  });

  it("date が無ければ BAD_REQUEST", async () => {
    await expect(mockApi("dailyQuests")).rejects.toThrow("BAD_REQUEST");
  });
});

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

  it("休日前夜の未選択は20時台なら未登録ペナルティにならない（既定就寝21時）", async () => {
    vi.setSystemTime(new Date(2026, 6, 24, 20, 30, 0));

    const home = await mockApi<{ todayStatus: string; questAction: string }>("home");

    expect(home.todayStatus).toBe("unanswered");
    expect(home.questAction).toBe("start");
  });

  it("休日前夜の未選択は21時超で未登録扱いになる", async () => {
    vi.setSystemTime(new Date(2026, 6, 24, 21, 0, 1));

    const home = await mockApi<{ todayStatus: string; questAction: string }>("home");

    expect(home.todayStatus).toBe("pending_ack");
    expect(home.questAction).toBe("none");
  });

  it("休日前夜の未選択は20時台なら新規登録できる（既定就寝21時）", async () => {
    const date = "2026-07-03";
    vi.setSystemTime(new Date(2026, 6, 3, 20, 30, 0));

    const result = await mockApi<{ submittedAt: string; overwritten: boolean }>("answers", {
      method: "POST",
      body: JSON.stringify({ date, answers: sampleAnswers }),
    });

    expect(result.overwritten).toBe(false);
  });

  it("休日前夜の未選択は21時超で新規登録を拒否する", async () => {
    const date = "2026-07-10";
    vi.setSystemTime(new Date(2026, 6, 10, 21, 0, 1));

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
    // 土曜＝休日前日。就寝設定は18時前、登録受付は20:00〜21:00（既定21時）
    vi.setSystemTime(new Date(2026, 5, 6, 17, 0, 0));

    await mockApi("registrationSetting", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 21, actor: "child" }),
    });

    vi.setSystemTime(new Date(2026, 5, 6, 20, 30, 0));
    await mockApi("answers", {
      method: "POST",
      body: JSON.stringify({ date, answers: sampleAnswers, bedtimeHour: 21 }),
    });

    vi.setSystemTime(new Date(2026, 5, 6, 17, 0, 0));
    await expect(
      mockApi("registrationSetting", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 23, actor: "child" }),
      }),
    ).rejects.toThrow("回答後は就寝時刻を変更できません");
  });

  it("18時以降は子どもが bedtime を変更できない", async () => {
    const date = "2026-06-13";
    vi.setSystemTime(new Date(2026, 5, 13, 17, 0, 0));

    await mockApi("registrationSetting", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 21, actor: "child" }),
    });

    vi.setSystemTime(new Date(2026, 5, 13, 18, 0, 0));

    await expect(
      mockApi("registrationSetting", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 23, actor: "child" }),
      }),
    ).rejects.toThrow("18時を過ぎているため子どもは bedtimeHour を設定できません");
  });

  it("18時前なら就寝時刻を変更できる", async () => {
    const date = "2026-06-13";
    vi.setSystemTime(new Date(2026, 5, 13, 17, 0, 0));

    await mockApi("registrationSetting", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 23, actor: "child" }),
    });

    const changed = await mockApi<{ bedtimeHour: number }>("registrationSetting", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 21, actor: "child" }),
    });
    expect(changed.bedtimeHour).toBe(21);
  });

  it("休日前夜・18時前なら就寝時刻を設定できる", async () => {
    const date = "2026-07-17";
    vi.setSystemTime(new Date(2026, 6, 17, 17, 30, 0));

    const result = await mockApi<{ date: string; bedtimeHour: number }>("registrationSetting", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 22, actor: "child" }),
    });

    expect(result.bedtimeHour).toBe(22);
  });

  it("平日は21時指定でも registrationSetting を受け付けない", async () => {
    const date = "2026-07-01";
    vi.setSystemTime(new Date(2026, 6, 1, 17, 0, 0));

    await expect(
      mockApi("registrationSetting", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 21, actor: "child"}),
      }),
    ).rejects.toThrow(
      "休日前日または長期休み（18時まで）のみ bedtimeHour を設定できます",
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

  it("長期休み中は平日でも就寝設定を受け付ける（18時まで）", async () => {
    vi.useFakeTimers();
    const date = "2026-08-11"; // 火曜・他テストと日付衝突しない
    vi.setSystemTime(new Date(2026, 7, 11, 17, 0, 0));
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
      { questId: "wake-on-time", childAnswer: 1 },
      { questId: "brush-teeth-gargle-am", childAnswer: -1 },
      { questId: "wash-hands-gargle-after-school", childAnswer: 1 },
      { questId: "homework-done-today", childAnswer: 1 },
      { questId: "phone-non-emergency-unused", childAnswer: 1 },
      { questId: "save-water-hot-water", childAnswer: 1 },
      { questId: "no-repeated-warnings", childAnswer: 1 },
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
          { questId: "wake-on-time", actualDone: true },
          { questId: "wash-hands-gargle-after-school", actualDone: true },
          { questId: "homework-done-today", actualDone: true },
          { questId: "phone-non-emergency-unused", actualDone: true },
          { questId: "save-water-hot-water", actualDone: false },
          { questId: "no-repeated-warnings", actualDone: true },
          { questId: "listen-to-mama-before-warning", actualDone: true },
        ],
      }),
    });
    expect(graded.gradedAt).toBeTruthy();

    const detail = await mockApi<{
      items: { questId: string; actualDone: boolean | null }[];
    }>("grade", undefined, { date });
    const byId = new Map(detail.items.map((item) => [item.questId, item.actualDone]));
    expect(byId.get("sleep-on-time-yesterday")).toBeNull();
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
            { questId: "wake-on-time", actualDone: true },
            { questId: "brush-teeth-gargle-am", actualDone: true },
            { questId: "wash-hands-gargle-after-school", actualDone: true },
            { questId: "homework-done-today", actualDone: true },
            { questId: "phone-non-emergency-unused", actualDone: true },
            { questId: "save-water-hot-water", actualDone: true },
            { questId: "no-repeated-warnings", actualDone: true },
            { questId: "listen-to-mama-before-warning", actualDone: true },
          ],
        }),
      }),
    ).rejects.toThrow("肯定回答以外は採点不要");
  });
});

describe("mockApi registrationSetting actor=parent 制約", () => {
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

  it("長期休み・子どもの18時以降でも保護者は就寝を変更できる", async () => {
    const date = "2026-08-11";
    vi.setSystemTime(new Date(2026, 7, 11, 19, 0, 0));
    setMockHomeModeFlags({ vacationMode: true });

    const saved = await mockApi<{ bedtimeHour: number }>("registrationSetting", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 22, actor: "parent" }),
    });
    expect(saved.bedtimeHour).toBe(22);
  });

  it("免除日は拒否する", async () => {
    const date = "2026-08-11";
    vi.setSystemTime(new Date(2026, 7, 11, 13, 0, 0));
    setMockHomeModeFlags({ vacationMode: true, exemptDates: [date] });

    await expect(
      mockApi("registrationSetting", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 22, actor: "parent" }),
      }),
    ).rejects.toThrow("免除日");
  });

  it("回答提出後は拒否する", async () => {
    const date = "2026-08-11";
    vi.setSystemTime(new Date(2026, 7, 11, 13, 0, 0));
    setMockHomeModeFlags({ vacationMode: true });

    await mockApi("registrationSetting", {
      method: "POST",
      body: JSON.stringify({ date, bedtimeHour: 23, actor: "parent" }),
    });

    vi.setSystemTime(new Date(2026, 7, 11, 22, 15, 0));
    await mockApi("answers", {
      method: "POST",
      body: JSON.stringify({ date, answers: sampleAnswers }),
    });

    vi.setSystemTime(new Date(2026, 7, 11, 13, 0, 0));
    await expect(
      mockApi("registrationSetting", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 22, actor: "parent" }),
      }),
    ).rejects.toThrow(/ALREADY_ANSWERED|回答後/);
  });

  it("就寝1時間前以降は拒否する", async () => {
    const date = "2026-08-11";
    vi.setSystemTime(new Date(2026, 7, 11, 20, 0, 0));
    setMockHomeModeFlags({ vacationMode: true });

    await expect(
      mockApi("registrationSetting", {
        method: "POST",
        body: JSON.stringify({ date, bedtimeHour: 21, actor: "parent" }),
      }),
    ).rejects.toThrow("FORBIDDEN_STATE");
  });
});

describe("mockApi answers 長期休み最終日の wakePromise", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearMockHomeModeFlags();
    resetMockStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearMockHomeModeFlags();
    resetMockStore();
  });

  it("最終日（翌日平日）は wakePromise を拒否し、未送信なら 07:15 を自動設定する", async () => {
    const date = "2026-08-31"; // 月曜最終日、翌日火曜平日
    vi.setSystemTime(new Date(2026, 7, 31, 20, 30, 0));
    await mockApi("longVacation", {
      method: "POST",
      body: JSON.stringify({
        startDate: "2026-07-25",
        endDate: "2026-08-31",
      }),
    });

    await expect(
      mockApi("answers", {
        method: "POST",
        body: JSON.stringify({
          date,
          answers: sampleAnswers,
          bedtimeHour: 21,
          wakePromise: { wakeTime: "08:00" },
        }),
      }),
    ).rejects.toThrow(/wakePromise/);

    await mockApi("answers", {
      method: "POST",
      body: JSON.stringify({
        date,
        answers: sampleAnswers,
        bedtimeHour: 21,
      }),
    });
    expect(getMockWakeUp(date)).toBe("07:15");
  });

  it("長期休みの中日は wakePromise を受け付ける", async () => {
    const date = "2026-08-11"; // 火曜・中日
    vi.setSystemTime(new Date(2026, 7, 11, 20, 30, 0));
    await mockApi("longVacation", {
      method: "POST",
      body: JSON.stringify({
        startDate: "2026-07-25",
        endDate: "2026-08-31",
      }),
    });

    await mockApi("answers", {
      method: "POST",
      body: JSON.stringify({
        date,
        answers: sampleAnswers,
        bedtimeHour: 21,
        wakePromise: { wakeTime: "08:30" },
      }),
    });
    expect(getMockWakeUp(date)).toBe("08:30");
  });
});

describe("mockApi registrationReopen 受付再開", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearMockHomeModeFlags();
    resetMockStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearMockHomeModeFlags();
    resetMockStore();
  });

  it("再開枠内なら締切後も回答できる", async () => {
    const date = "2026-06-07";
    // endsAt は +09:00 絶対時刻。システム時刻も JST 明示（TZ=Asia/Tokyo 前提）
    vi.setSystemTime(new Date("2026-06-07T21:30:00+09:00"));

    await mockApi("registrationReopen", {
      method: "POST",
      body: JSON.stringify({
        date,
        endsAt: "2026-06-07T22:30:00+09:00",
      }),
    });

    vi.setSystemTime(new Date("2026-06-07T21:45:00+09:00"));

    const result = await mockApi<{ submittedAt: string }>("answers", {
      method: "POST",
      body: JSON.stringify({ date, answers: sampleAnswers, bedtimeHour: 21 }),
    });
    expect(result.submittedAt).toBeTruthy();
  });

  it("再開枠内なら home が questAction=start を返す", async () => {
    const date = "2026-06-07";
    vi.setSystemTime(new Date("2026-06-07T21:30:00+09:00"));

    await mockApi("registrationReopen", {
      method: "POST",
      body: JSON.stringify({
        date,
        endsAt: "2026-06-07T22:30:00+09:00",
      }),
    });

    vi.setSystemTime(new Date("2026-06-07T21:45:00+09:00"));

    const home = await mockApi<HomeData>("home", undefined, { date });
    expect(home.questAction).toBe("start");
    expect(home.todayStatus).toBe("unanswered");
    expect(home.registrationReopen?.isOpen).toBe(true);
  });
});

describe("mockApi questExemptions 後付け救済・未来日除外", () => {
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

  it("後付け免除で未 ack の未登録 -60 を exempt に置換し確認できない", async () => {
    const date = "2026-07-01";
    vi.setSystemTime(new Date(2026, 6, 1, 21, 30, 0));

    await mockApi<HomeData>("home", undefined, { date });
    const before = await mockApi<{
      items: Array<{
        date: string;
        reasonCode: string;
        totalPoints: number;
        requiresAck: boolean;
        acknowledged: boolean;
      }>;
    }>("results");
    const missed = before.items.find((i) => i.date === date);
    expect(missed?.reasonCode).toBe("unregistered");
    expect(missed?.totalPoints).toBe(-60);
    expect(missed?.requiresAck).toBe(true);

    const homeBefore = await mockApi<HomeData>("home", undefined, { date });
    const balanceBefore = homeBefore.displayBalance;

    const exemption = await mockApi<{
      changedDates: string[];
      skippedDates: string[];
    }>("questExemptions", {
      method: "POST",
      body: JSON.stringify({ op: "add", startDate: date, endDate: date }),
    });
    expect(exemption.changedDates).toContain(date);

    const after = await mockApi<{
      items: Array<{
        date: string;
        reasonCode: string;
        totalPoints: number;
        requiresAck: boolean;
        acknowledged: boolean;
      }>;
    }>("results");
    const exempt = after.items.find((i) => i.date === date);
    expect(exempt?.reasonCode).toBe("exempt");
    expect(exempt?.totalPoints).toBe(0);
    expect(exempt?.requiresAck).toBe(false);
    expect(exempt?.acknowledged).toBe(true);
    expect(after.items.some((i) => i.date === date && i.reasonCode === "unregistered")).toBe(
      false,
    );

    await expect(
      mockApi("resultsAck", {
        method: "POST",
        body: JSON.stringify({ date }),
      }),
    ).rejects.toThrow("免除日の結果は確認不要です");

    const homeAfter = await mockApi<HomeData>("home", undefined, { date });
    expect(homeAfter.displayBalance).toBe(balanceBefore);
  });

  it("後付け免除で ack 済み未登録の -60 を残高へ冪等復元する", async () => {
    const date = "2026-07-02";
    vi.setSystemTime(new Date(2026, 6, 2, 21, 30, 0));

    await mockApi<HomeData>("home", undefined, { date });
    const homeBeforeAck = await mockApi<HomeData>("home", undefined, { date });
    const balanceBeforeAck = homeBeforeAck.displayBalance;

    const ack = await mockApi<{ appliedDelta: number; displayBalance: number }>(
      "resultsAck",
      {
        method: "POST",
        body: JSON.stringify({ date }),
      },
    );
    expect(ack.appliedDelta).toBe(-60);
    expect(ack.displayBalance).toBe(Math.max(0, balanceBeforeAck - 60));

    const exemption = await mockApi<{ changedDates: string[] }>("questExemptions", {
      method: "POST",
      body: JSON.stringify({ op: "add", startDate: date, endDate: date }),
    });
    expect(exemption.changedDates).toContain(date);

    const homeAfter = await mockApi<HomeData>("home", undefined, { date });
    expect(homeAfter.displayBalance).toBe(balanceBeforeAck);

    const results = await mockApi<{
      items: Array<{ date: string; reasonCode: string; totalPoints: number }>;
    }>("results");
    expect(results.items.find((i) => i.date === date)?.reasonCode).toBe("exempt");

    // 冪等: 同じ期間を再 add しても残高は変わらない
    await mockApi("questExemptions", {
      method: "POST",
      body: JSON.stringify({ op: "add", startDate: date, endDate: date }),
    });
    const homeIdempotent = await mockApi<HomeData>("home", undefined, { date });
    expect(homeIdempotent.displayBalance).toBe(balanceBeforeAck);
  });

  it("未来の免除日は results に載せない", async () => {
    vi.setSystemTime(new Date(2026, 6, 30, 12, 0, 0));
    const past = "2026-07-29";
    const future = "2026-08-05";

    await mockApi("questExemptions", {
      method: "POST",
      body: JSON.stringify({ op: "add", startDate: past, endDate: future }),
    });

    const results = await mockApi<{
      items: Array<{ date: string; reasonCode: string }>;
    }>("results");
    const dates = results.items
      .filter((i) => i.reasonCode === "exempt")
      .map((i) => i.date);

    expect(dates).toContain(past);
    expect(dates).toContain("2026-07-30");
    expect(dates.some((d) => d > "2026-07-30")).toBe(false);
    expect(dates).not.toContain(future);
  });

  it("当日免除フラグ中でも過去の未確認結果を確認できる", async () => {
    const pastDate = "2026-07-28";
    const today = "2026-07-30";

    // 過去日に未登録（未確認）結果を作る
    vi.setSystemTime(new Date(2026, 6, 28, 21, 30, 0));
    await mockApi<HomeData>("home", undefined, { date: pastDate });

    // 当日は localStorage フラグのみで免除（exemptDatesOverride は使わない）
    vi.setSystemTime(new Date(2026, 6, 30, 12, 0, 0));
    clearParentLocalSettings();
    localStorage.setItem(MOCK_EXEMPT_FLAG_KEY, "1");

    const homeToday = await mockApi<HomeData>("home");
    expect(homeToday.today).toBe(today);
    expect(homeToday.isExemptToday).toBe(true);

    const results = await mockApi<{
      items: Array<{
        date: string;
        reasonCode: string;
        requiresAck: boolean;
        acknowledged: boolean;
      }>;
    }>("results");
    const past = results.items.find((i) => i.date === pastDate);
    expect(past?.reasonCode).toBe("unregistered");
    expect(past?.requiresAck).toBe(true);
    expect(past?.acknowledged).toBe(false);

    const ack = await mockApi<{ appliedDelta: number }>("resultsAck", {
      method: "POST",
      body: JSON.stringify({ date: pastDate }),
    });
    expect(ack.appliedDelta).toBe(-60);

    // 当日（免除）自体の ack は引き続き拒否
    await expect(
      mockApi("resultsAck", {
        method: "POST",
        body: JSON.stringify({ date: today }),
      }),
    ).rejects.toThrow("免除日の結果は確認不要です");
  });
});
