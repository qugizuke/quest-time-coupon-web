/**
 * @file API 型定義
 * @description GAS Web App レスポンスの共有型。
 */

/** 子どもの3択回答 */
export type ChildAnswer = 1 | 0 | -1;

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
}

/** クエスト定義 */
export interface QuestDefinition {
  id: string;
  order: number;
  title: string;
  hint?: string;
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
}
