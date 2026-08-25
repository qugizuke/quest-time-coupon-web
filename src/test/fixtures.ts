/**
 * @file テスト用 HomeData / ParentHomeData ファクトリ
 * @description 負債フィールドを含む最小 HomeData を組み立てる。
 */
import type { HomeData, ParentHomeData } from "@/types/api";
import { normalizeBalanceDebtFields } from "@/lib/balanceDebt";
import { zeroRewardVouchers } from "@/lib/rewardVouchers";

/**
 * テスト用 HomeData を組み立てる
 * @param {Partial<HomeData>} [overrides] - 上書き
 * @returns {HomeData} HomeData
 */
export function buildHomeData(overrides: Partial<HomeData> = {}): HomeData {
  const balance = normalizeBalanceDebtFields({
    switchMinutes: overrides.switchMinutes ?? overrides.displayBalance ?? 60,
    displayBalance: overrides.displayBalance,
    penaltyMinutes: overrides.penaltyMinutes ?? 0,
    debtMinutes: overrides.debtMinutes,
    issuablePenaltyTicketCount: overrides.issuablePenaltyTicketCount,
  });

  return {
    ...balance,
    rewardVouchers: zeroRewardVouchers(),
    today: "2026-08-24",
    todayStatus: "completed",
    questAction: "none",
    unacknowledgedCount: 0,
    canStartTimer:
      balance.displayBalance > 0 && balance.penaltyMinutes === 0,
    timerBlockCount: 0,
    isLongVacation: false,
    isVacationTransition: false,
    vacationPhase: "none",
    isExemptToday: false,
    isWeekendEve: false,
    registrationReopen: null,
    wakePromiseYesterday: null,
    bedtimeEditableUntil: null,
    questDeadlineAt: null,
    bonusDeadlineAt: null,
    isExemptDay: false,
    isVacationMode: false,
    ...overrides,
    ...normalizeBalanceDebtFields({
      ...balance,
      ...overrides,
    }),
  };
}

/**
 * テスト用 ParentHomeData を組み立てる
 * @param {Partial<ParentHomeData>} [overrides] - 上書き
 * @returns {ParentHomeData} ParentHomeData
 */
export function buildParentHomeData(
  overrides: Partial<ParentHomeData> = {},
): ParentHomeData {
  const balance = normalizeBalanceDebtFields({
    switchMinutes: overrides.switchMinutes ?? overrides.displayBalance ?? 60,
    displayBalance: overrides.displayBalance,
    penaltyMinutes: overrides.penaltyMinutes ?? 0,
    debtMinutes: overrides.debtMinutes,
    issuablePenaltyTicketCount: overrides.issuablePenaltyTicketCount,
  });

  return {
    date: "2026-08-24",
    ungradedCount: 0,
    todayRegistrationStatus: "registered",
    registrationReopen: {
      available: false,
      used: false,
      endsAt: null,
      setAt: null,
      isOpen: false,
    },
    isExemptToday: false,
    isLongVacation: false,
    isVacationTransition: false,
    vacationPhase: "none",
    longVacation: { startDate: "", endDate: "", active: false },
    bedtimeHour: 21,
    canEditBedtimeAsParent: false,
    questDeadlineAt: null,
    rewardVouchers: zeroRewardVouchers(),
    ...balance,
    ...overrides,
    ...normalizeBalanceDebtFields({
      ...balance,
      ...overrides,
    }),
  };
}
