/**
 * @file API 型定義
 * @description API レスポンスの共有型。正本は docs `api-tobe-f-contract.md`（Issue #20 / F）。
 *   `{ ok, data, error }` 形。保護者パスワードはフロントのみ（サーバ親セッションなし）。
 */

/** 子どもの回答値 */
export type ChildAnswer = 1 | 0 | -1;

/** 就寝時刻（時） */
export type BedtimeHour = 21 | 22 | 23;

/**
 * 起床約束の時刻。
 * UI 選択は 07:00 / 07:30 / 08:00 / 08:30 / 09:00 の5値。
 * `"07:15"` は長期休み最終日（翌日平日）など Functions が自動書き込みする保存専用値。
 */
export type WakeTime =
  | "07:00"
  | "07:15"
  | "07:30"
  | "08:00"
  | "08:30"
  | "09:00";

/**
 * @deprecated WakeTime の別名（既存 UI 互換）
 */
export type WakeUpTime = WakeTime;

/** UI で子どもが選べる起床時刻（07:15 は含まない） */
export type SelectableWakeTime = Exclude<WakeTime, "07:15">;

/** API 共通レスポンス */
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/** result.reasonCode（契約 §2.4） */
export type ReasonCode =
  | "normal"
  | "unregistered"
  | "grade_rejected"
  | "exempt";

/** ホーム todayStatus */
export type TodayStatus =
  | "unanswered"
  | "answered_ungraded"
  | "pending_ack"
  | "completed"
  | "exempt";

/** ホーム questAction */
export type QuestAction = "start" | "retry" | "none";

/** registrationSetting の actor（認証ではない・ウィンドウ選択用） */
export type RegistrationActor = "child" | "parent";

/** 子ども向け registrationReopen 参照 */
export interface HomeRegistrationReopen {
  endsAt: string;
  setAt: string;
  used: boolean;
  isOpen: boolean;
}

/** 昨日の起床約束 */
export interface WakePromiseView {
  wakeTime: WakeTime;
  setAt: string;
}

/** GET home（契約 §3.4） */
export interface HomeData {
  displayBalance: number;
  penaltyMinutes: number;
  today: string;
  todayStatus: TodayStatus;
  questAction: QuestAction;
  unacknowledgedCount: number;
  timerBlockCount: number;
  canStartTimer: boolean;
  bedtimeHour?: BedtimeHour;
  isWeekendEve: boolean;
  isLongVacation: boolean;
  isExemptToday: boolean;
  registrationReopen: HomeRegistrationReopen | null;
  wakePromiseYesterday: WakePromiseView | null;
  bedtimeEditableUntil: string | null;
  questDeadlineAt: string | null;
  bonusDeadlineAt: string | null;
  /**
   * UI 互換エイリアス（`isExemptToday` と同値）。
   * @deprecated 新規コードは isExemptToday を使う
   */
  isExemptDay: boolean;
  /**
   * UI 互換エイリアス（`isLongVacation` と同値）。
   * @deprecated 新規コードは isLongVacation を使う
   */
  isVacationMode: boolean;
}

/** 保護者ホーム todayRegistrationStatus */
export type TodayRegistrationStatus =
  | "exempt"
  | "registered"
  | "open_unregistered"
  | "closed_unregistered"
  | "reopen_open"
  | "graded"
  | "result_pending_ack";

/** 保護者向け registrationReopen */
export interface ParentRegistrationReopen {
  available: boolean;
  used: boolean;
  endsAt: string | null;
  setAt: string | null;
  isOpen: boolean;
}

/** GET parentHome（契約 §3.5） */
export interface ParentHomeData {
  date: string;
  ungradedCount: number;
  todayRegistrationStatus: TodayRegistrationStatus;
  registrationReopen: ParentRegistrationReopen;
  isExemptToday: boolean;
  isLongVacation: boolean;
  longVacation: {
    startDate: string;
    endDate: string;
    active: boolean;
  };
  bedtimeHour: BedtimeHour;
  canEditBedtimeAsParent: boolean;
  questDeadlineAt: string | null;
}

/** GET/POST longVacation */
export interface LongVacationData {
  startDate: string;
  endDate: string;
  updatedAt: string;
  active: boolean;
}

/** 免除期間（id なし） */
export interface ExemptionPeriod {
  startDate: string;
  endDate: string;
  createdAt: string;
}

/** GET/POST questExemptions */
export interface QuestExemptionsData {
  periods: ExemptionPeriod[];
  updatedAt: string;
  changedDates?: string[];
  skippedDates?: string[];
}

/** 採点モード */
export type GradingMode =
  | "parent_choice"
  | "auto_fail"
  | "auto_worst"
  | "skip"
  | "display_only";

/** GET gradeDates 1件 */
export interface GradeDateItem {
  date: string;
  status: "ungraded" | "graded" | "unanswered" | "exempt";
  ungradedCount: number;
  totalPoints: number | null;
  reasonCode: ReasonCode | null;
  isExempt: boolean;
}

/** GET grade */
export interface GradeData {
  date: string;
  submittedAt: string | null;
  withinBonusWindow: boolean;
  isExempt: boolean;
  alreadyGraded: boolean;
  reasonCode: ReasonCode | null;
  items: Array<{
    questId: string;
    childAnswer: ChildAnswer;
    actualDone: boolean | null;
    gradingMode: GradingMode;
    autoOutcome: string | null;
  }>;
  adjustments: GradeAdjustment[];
  /** UI 互換（alreadyGraded） */
  isGraded: boolean;
  /** UI 互換（reasonCode === grade_rejected） */
  isRejected: boolean;
  /** UI 互換（withinBonusWindow） */
  withinBonusDeadline: boolean;
}

/** GET results 1件 */
export interface ResultItem {
  date: string;
  totalPoints: number;
  acknowledged: boolean;
  reasonCode: ReasonCode;
  breakdown?: {
    questPoints: number;
    onTimeBonus: number;
    perfectBonus: number;
    adjustmentsSum: number;
    bedtimePrepPenalty: number;
  };
  registrationTimingAdjustment: number;
  registrationTimingReason?: string;
  bedtimePrepPenalty?: number;
  bedtimePrepPenaltyReason?: string;
  adjustments?: Array<{
    kind: "bonus" | "penalty";
    code: string;
    label: string;
    minutes: number;
  }>;
  details: Array<{
    questId: string;
    childAnswer: ChildAnswer;
    actualDone: boolean;
    finalPoints: number;
    mismatch: boolean;
    /** 採点モード（履歴で -1 のスキップ/分からない区別・契約 §3.6） */
    gradingMode?: GradingMode;
    streakMultiplier?: number;
    failureStreakAfter?: number;
    category?: QuestCategory;
  }>;
  requiresAck: boolean;
  blocksTimer: boolean;
}

/** クエストカテゴリ（routine=日々のルーティン, reminder=毎日注意されているもの） */
export type QuestCategory = "routine" | "reminder";

/** クエスト回答形式 */
export type QuestAnswerMode = "default" | "binary";

/** クエスト採点上の役割 */
export type QuestScoringRole = "standard" | "registrationGate" | "conditional";

/** 条件分岐ゲートの回答形式 */
export type QuestGateAnswerMode = "yesNo";

/** クエストマスタの生成方式（契約 §3.16・当面は常に fixed_seed） */
export type QuestGenerationMode = "fixed_seed" | "draw";

/** 条件分岐メタデータ */
export interface QuestConditional {
  /** ゲート問の回答形式 */
  gateAnswerMode?: QuestGateAnswerMode;
  /** この回答のとき追問を表示 */
  followUpWhen: ChildAnswer;
  /** 追問のタイトル */
  followUpTitle: string;
  /** ゲート回答を API 送信するか */
  persistGateAnswer?: boolean;
}

/** クエスト定義 */
export interface QuestDefinition {
  id: string;
  order: number;
  /** @type {QuestCategory} カテゴリ（未設定時は routine 扱い） */
  category?: QuestCategory;
  /** @type {QuestAnswerMode} 回答形式（未設定時は default） */
  answerMode?: QuestAnswerMode;
  /** @type {QuestScoringRole} 採点上の役割（未設定時は standard） */
  scoringRole?: QuestScoringRole;
  title: string;
  hint?: string;
  /** 条件付き追問（宿題など） */
  conditional?: QuestConditional;
}

/** GET dailyQuests（契約 §3.16・Issue #28） */
export interface DailyQuests {
  /** リクエストした date（YYYY-MM-DD）をそのまま返す */
  date: string;
  /** meta/questPool.schemaVersion */
  version: number;
  /** 固定10問か将来の抽選か（当面は常に fixed_seed） */
  generationMode: QuestGenerationMode;
  quests: QuestDefinition[];
}

/** 回答下書き（未選択時は childAnswer なし） */
export interface DraftAnswer {
  questId: string;
  childAnswer?: ChildAnswer;
}

export interface QuestDraft {
  answers: DraftAnswer[];
  index: number;
  /** 追問表示中の questId */
  followUpQuestId?: string;
  /** API に送らないゲート回答（例: 宿題をやったか） */
  gateAnswers?: Record<string, ChildAnswer>;
}

/** 保護者裁量の加減点 */
export type AdjustmentKind = "bonus" | "penalty";

export type AdjustmentCode = string;

export interface GradeAdjustment {
  kind: AdjustmentKind;
  code: AdjustmentCode;
  minutes: number;
}

/** 定義済み調整項目 */
export interface AdjustmentDefinition {
  kind: AdjustmentKind;
  code: AdjustmentCode;
  label: string;
}

/** 任意加減点定義 */
export interface GradeAdjustmentDefinitions {
  version: number;
  items: AdjustmentDefinition[];
}
