/**
 * @file クエスト登録締切ユーティリティのテスト
 */
import { describe, expect, it } from "vitest";
import {
  formatQuestBonusDeadlineLabel,
  formatQuestRegistrationCutoffLabel,
  formatQuestRegistrationStartLabel,
  getQuestBonusDeadline,
  getQuestRegistrationCutoff,
  getQuestRegistrationStart,
  isBeforeQuestRegistrationStart,
  isPastQuestBonusDeadline,
  isPastQuestRegistrationCutoff,
  isQuestRegistrationOpen,
} from "@/lib/deadline";

describe("getQuestBonusDeadline", () => {
  it("就寝21時は20:30", () => {
    const d = getQuestBonusDeadline("2026-06-07", 21);
    expect(d.getHours()).toBe(20);
    expect(d.getMinutes()).toBe(30);
  });

  it("就寝22時は21:30", () => {
    const d = getQuestBonusDeadline("2026-06-07", 22);
    expect(d.getHours()).toBe(21);
    expect(d.getMinutes()).toBe(30);
  });

  it("就寝23時は22:30", () => {
    const d = getQuestBonusDeadline("2026-06-07", 23);
    expect(d.getHours()).toBe(22);
    expect(d.getMinutes()).toBe(30);
  });
});

describe("getQuestRegistrationStart", () => {
  it("就寝21時は20:00", () => {
    const d = getQuestRegistrationStart("2026-06-07", 21);
    expect(d.getHours()).toBe(20);
    expect(d.getMinutes()).toBe(0);
  });

  it("就寝22時は21:00", () => {
    const d = getQuestRegistrationStart("2026-06-07", 22);
    expect(d.getHours()).toBe(21);
    expect(d.getMinutes()).toBe(0);
  });

  it("就寝23時は22:00", () => {
    const d = getQuestRegistrationStart("2026-06-07", 23);
    expect(d.getHours()).toBe(22);
    expect(d.getMinutes()).toBe(0);
  });
});

describe("getQuestRegistrationCutoff", () => {
  it("就寝22時は22:00", () => {
    const d = getQuestRegistrationCutoff("2026-06-07", 22);
    expect(d.getHours()).toBe(22);
    expect(d.getMinutes()).toBe(0);
  });
});

describe("isBeforeQuestRegistrationStart", () => {
  const date = "2026-06-07";

  it("19:59 は受付開始前", () => {
    expect(isBeforeQuestRegistrationStart(date, new Date(2026, 5, 7, 19, 59, 59), 21)).toBe(
      true,
    );
  });

  it("20:00 は受付開始後", () => {
    expect(isBeforeQuestRegistrationStart(date, new Date(2026, 5, 7, 20, 0, 0), 21)).toBe(
      false,
    );
  });
});

describe("isQuestRegistrationOpen", () => {
  const date = "2026-06-07";

  it("受付時間帯内は true", () => {
    expect(isQuestRegistrationOpen(date, new Date(2026, 5, 7, 20, 15, 0), 21)).toBe(true);
  });

  it("受付開始前は false", () => {
    expect(isQuestRegistrationOpen(date, new Date(2026, 5, 7, 19, 59, 0), 21)).toBe(false);
  });

  it("受付締切後は false", () => {
    expect(isQuestRegistrationOpen(date, new Date(2026, 5, 7, 21, 0, 1), 21)).toBe(false);
  });
});

describe("isPastQuestBonusDeadline", () => {
  it("就寝22時は21:30:01 で締切後", () => {
    expect(
      isPastQuestBonusDeadline("2026-06-07", new Date(2026, 5, 7, 21, 30, 1), 22),
    ).toBe(true);
  });
});

describe("isPastQuestRegistrationCutoff", () => {
  it("就寝22時は22:00:01 で締切後", () => {
    expect(
      isPastQuestRegistrationCutoff("2026-06-07", new Date(2026, 5, 7, 22, 0, 1), 22),
    ).toBe(true);
  });
});

describe("format labels", () => {
  it("就寝22時のラベル", () => {
    expect(formatQuestRegistrationStartLabel(22)).toBe("21:00");
    expect(formatQuestBonusDeadlineLabel("2026-06-07", 22)).toBe("21:30");
    expect(formatQuestRegistrationCutoffLabel(22)).toBe("22:00");
  });
});
