/**
 * @file API 型定義
 * @description GAS Web App レスポンスの共有型。
 */

/** 子どもの3択回答 */
export type ChildAnswer = 1 | 0 | -1;

/** 就寝時刻（時） */
export type BedtimeHour = 21 | 22 | 23;

/** API 共通レスポンス */
export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string };
}

/** ホーム todayStatus */
export type TodayStatus =
  | "unanswered"
  | "answered_ungraded"
  | "pending_ack"
  | "completed";

/** ホーム questAction */
export type QuestAction = "start" | "retry" | "none";

/** GET home */
export interface HomeData {
  displayBalance: number;
  penaltyMinutes: number;
  today: string;
  todayStatus: TodayStatus;
  questAction: QuestAction;
  unacknowledgedCount: number;
  canStartTimer: boolean;
  /** 金土の就寝時刻（時）。未設定時は 21 */
  bedtimeHour?: BedtimeHour;
  /** 金土（休日前日）か */
  isWeekendEve?: boolean;
}

/** クエストカテゴリ（routine=日々のルーティン, reminder=毎日注意されているもの） */
export type QuestCategory = "routine" | "reminder";

/** 条件分岐メタデータ */
export interface QuestConditional {
  /** この回答のとき追問を表示 */
  followUpWhen: ChildAnswer;
  /** 追問のタイトル */
  followUpTitle: string;
}

/** クエスト定義 */
export interface QuestDefinition {
  id: string;
  order: number;
  /** @type {QuestCategory} カテゴリ（未設定時は routine 扱い） */
  category?: QuestCategory;
  title: string;
  hint?: string;
  /** 条件付き追問（宿題など） */
  conditional?: QuestConditional;
}

export interface DailyQuests {
  version: number;
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
}

/** 保護者裁量の加減点 */
export type AdjustmentKind = "bonus" | "penalty";

export type AdjustmentCode = "helped" | "test100" | "lied" | "defiant";

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

/** 保護者採点画面用の調整選択状態 */
export interface AdjustmentSelection {
  enabled: boolean;
  minutes: number;
}
