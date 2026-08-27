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

/** GET home（契約 §3.4・ADR-005） */
export interface HomeData {
  /**
   * クエスト結果で増減するポイント残高（pt）。
   * ADR-006 以降は負を許容し、0止めしない（交換承認・負債穴埋めで負・正どちらにも動く）。
   */
  balancePoints: number;
  /**
   * Switch / YouTube 共通時間の残高（分）。交換承認（#38）でのみ増え、タイマー使用で減る。
   * 0未満にはならない（超過分は penaltyMinutes へ）。
   */
  switchMinutes: number;
  /**
   * 表示用残高（分）。タイマーで使える分数として switchMinutes を返す（契約 §3.3）。
   * サーバ未対応時は switchMinutes と同値に正規化する。
   */
  displayBalance: number;
  /** タイマー超過分（分）。ペナルティチケットとは別概念 */
  penaltyMinutes: number;
  /**
   * 合算負債（分）= max(0, -switchMinutes) + penaltyMinutes。
   * サーバ未返却時は UI 側で算出する。
   */
  debtMinutes: number;
  /** 発行可能枚数 = floor(max(0, -balancePoints) / 100) */
  issuablePenaltyTicketCount: number;
  /** 未消費のペナルティチケット枚数（≥ 0）。欠落時は 0 として読む（契約 §3.3 / §3.4） */
  penaltyTicketCount: number;
  today: string;
  todayStatus: TodayStatus;
  questAction: QuestAction;
  unacknowledgedCount: number;
  timerBlockCount: number;
  canStartTimer: boolean;
  bedtimeHour?: BedtimeHour;
  isWeekendEve: boolean;
  isLongVacation: boolean;
  /** 長期休みモード終了1週間前の移行期間中か（Issue #36） */
  isVacationTransition: boolean;
  /** 長期休みフェーズ。旧Functionsではbooleanから補完する */
  vacationPhase?: "none" | "active" | "transition";
  /**
   * 報酬チケット在庫（契約 §3.3・§3.4・ADR-006）。5キーを必ず返す。欠落は0扱い。
   */
  rewardVouchers: RewardVouchers;
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
  /** 長期休みモード終了1週間前の移行期間中か（Issue #36） */
  isVacationTransition: boolean;
  /** 長期休みフェーズ。旧Functionsではbooleanから補完する */
  vacationPhase?: "none" | "active" | "transition";
  longVacation: {
    startDate: string;
    endDate: string;
    active: boolean;
  };
  bedtimeHour: BedtimeHour;
  canEditBedtimeAsParent: boolean;
  questDeadlineAt: string | null;
  /** クエスト結果で増減するポイント残高（pt）。0未満にはならない */
  balancePoints: number;
  /** Switch / YouTube 共通時間の残高（分）。0未満にはならない */
  switchMinutes: number;
  /** 表示用残高（タイマーで使える分数。switchMinutes と同値） */
  displayBalance: number;
  /** タイマー超過分（分） */
  penaltyMinutes: number;
  /** 合算負債（分） */
  debtMinutes: number;
  /** 発行可能枚数 = floor(max(0, -balancePoints) / 100) */
  issuablePenaltyTicketCount: number;
  /** 未消費のペナルティチケット枚数（≥ 0） */
  penaltyTicketCount: number;
  /** 報酬チケット在庫（5キー必須、欠落は0補完） */
  rewardVouchers?: RewardVouchers;
}

/**
 * POST penaltyTicketIssue レスポンス
 * @description 発行＝負債精算 + 在庫加算（`penaltyTicketCount += count`）。
 */
export interface PenaltyTicketIssueResult {
  ticketId: string;
  count: number;
  settledPoints: number;
  pointDebtBefore: number;
  pointDebtAfter: number;
  balancePoints: number;
  displayBalance: number;
  switchMinutes: number;
  penaltyMinutes: number;
  issuablePenaltyTicketCount: number;
  /** 発行後の在庫枚数 */
  penaltyTicketCount: number;
}

/**
 * POST penaltyTicketConsume レスポンス
 * @description 保護者が在庫チケットを1枚消費する。残高・負債は変えない。
 */
export interface PenaltyTicketConsumeResult {
  ticketId: string;
  /** 消費後の在庫枚数 */
  penaltyTicketCount: number;
}

/** GET/POST longVacation */
export type VacationPhase = "none" | "active" | "transition";

export interface LongVacationData {
  startDate: string;
  endDate: string;
  updatedAt: string;
  active: boolean;
  vacationPhase: VacationPhase;
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
    points: number;
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
  /** 加減点（pt）。ADR-005 でポイント通貨化に伴い分からポイントへ変更 */
  points: number;
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

/**
 * ポイント交換の固定カタログ ID（契約 §3.11.1）。
 * カタログは変更不可（Issue #38 / #43 スコープ・任意カタログ・YouTube 単品交換は非対応）。
 */
export type PointExchangeCatalogItemId =
  | "snack-10"
  | "switch-30"
  | "switch-60"
  | "cash-100"
  | "dining-1000"
  | "penalty-ticket-100";

/**
 * 報酬チケット在庫（`rewardVouchers`）の対象カタログ ID（契約 ADR-006）。
 * `penalty-ticket-100` は在庫化・戻し・負債穴埋めの対象外（従来どおりの消費のみ）。
 */
export type RewardVoucherCatalogItemId = Exclude<
  PointExchangeCatalogItemId,
  "penalty-ticket-100"
>;

/** 報酬チケット在庫（5キーを必ず持つ。欠落は0扱い・契約 §3.3） */
export type RewardVouchers = Record<RewardVoucherCatalogItemId, number>;

/** 子どもが即時使用できる物理報酬券（契約 §3.11.5） */
export type PhysicalRewardVoucherCatalogItemId = Exclude<
  RewardVoucherCatalogItemId,
  SwitchTicketCatalogItemId
>;

/** ポイント交換申請ステータス */
export type PointExchangeStatus = "pending" | "approved" | "rejected";

/** POST pointExchangeRequests 送信 1件 */
export interface PointExchangeRequestItemInput {
  catalogItemId: PointExchangeCatalogItemId;
  /** 1以上の整数 */
  quantity: number;
}

/** GET pointExchangeRequests の申請内訳 1件 */
export interface PointExchangeLineItem {
  catalogItemId: PointExchangeCatalogItemId;
  label: string;
  quantity: number;
  pointCost: number;
  subtotalPoints: number;
}

/**
 * 承認時（または承認予定）の副作用（契約 §3.11.1・ADR-006）。
 * `switch-30` / `switch-60` は承認時に `switchMinutes` へ直接加算せず、
 * `rewardVouchers` の在庫として発行する（消費は `switchTicketRedeem`）。
 */
export interface PointExchangeEffects {
  spentPoints: number;
  /** カタログ ID → 発行数量（`penalty-ticket-100` は含まない） */
  issuedRewardVouchers: Partial<Record<RewardVoucherCatalogItemId, number>>;
  consumedPenaltyTickets: number;
}

/** GET pointExchangeRequests 1件（契約 §3.11.1） */
export interface PointExchangeRequest {
  id: string;
  status: PointExchangeStatus;
  requestedAt: string;
  /** 未決定は空文字 */
  decidedAt: string;
  items: PointExchangeLineItem[];
  totalPoints: number;
  effects: PointExchangeEffects;
  /** 却下理由（任意）。未指定は空文字 */
  rejectReason: string;
}

/** GET pointExchangeRequests（契約 §3.11.1・子ども `/rewards`／保護者 `/parent/rewards` 共用） */
export interface PointExchangeRequestsData {
  month: string;
  items: PointExchangeRequest[];
}

/** POST pointExchangeRequests レスポンス（子ども申請・pending 作成のみ） */
export interface PointExchangeCreateResult {
  id: string;
  status: "pending";
  totalPoints: number;
  /** 申請時点の残高（このリクエストでは減らない） */
  balancePoints: number;
}

/** POST pointExchangeDecision の decision */
export type PointExchangeDecision = "approve" | "reject";

/** POST pointExchangeDecision レスポンス（承認／却下共用・契約 §3.11.1・ADR-006） */
export interface PointExchangeDecisionResult {
  id: string;
  status: PointExchangeStatus;
  /** 承認時のみ */
  spentPoints?: number;
  balancePoints: number;
  /** 承認時のみ（発行後の在庫スナップショット） */
  rewardVouchers?: RewardVouchers;
  /** 承認時のみ */
  penaltyTicketCount?: number;
}

/**
 * POST switchTicketRedeem の対象カタログ ID（契約 §3.11.2・Issue #45）。
 * 子どもが `/timer` で券を消費し `switchMinutes` を加算する。
 */
export type SwitchTicketCatalogItemId = "switch-30" | "switch-60";

/** POST switchTicketRedeem レスポンス（契約 §3.11.2） */
export interface SwitchTicketRedeemResult {
  catalogItemId: SwitchTicketCatalogItemId;
  /** 加算された分数（30 または 60） */
  redeemedMinutes: number;
  switchMinutes: number;
  rewardVouchers: RewardVouchers;
}

/** 戻し申請ステータス（契約 §3.11.3・Issue #46） */
export type RewardVoucherRefundStatus = "pending" | "approved" | "rejected";

/** POST rewardVoucherRefundRequests 送信 1件 */
export interface RewardVoucherRefundItemInput {
  catalogItemId: RewardVoucherCatalogItemId;
  /** 1以上の整数 */
  quantity: number;
}

/** GET rewardVoucherRefundRequests の申請内訳 1件 */
export interface RewardVoucherRefundLineItem {
  catalogItemId: RewardVoucherCatalogItemId;
  label: string;
  quantity: number;
  /** 券1枚あたりの戻しポイント（カタログ単価と同値） */
  pointValue: number;
  subtotalPoints: number;
}

/** GET rewardVoucherRefundRequests 1件（契約 §3.11.3） */
export interface RewardVoucherRefundRequest {
  id: string;
  status: RewardVoucherRefundStatus;
  requestedAt: string;
  /** 未決定は空文字 */
  decidedAt: string;
  items: RewardVoucherRefundLineItem[];
  totalPoints: number;
  /** 却下理由（任意）。未指定は空文字 */
  rejectReason: string;
}

/** GET rewardVoucherRefundRequests（契約 §3.11.3・子ども `/rewards`／保護者 `/parent/rewards` 共用） */
export interface RewardVoucherRefundRequestsData {
  month: string;
  items: RewardVoucherRefundRequest[];
}

/** POST rewardVoucherRefundRequests レスポンス（子ども申請・pending 作成のみ） */
export interface RewardVoucherRefundCreateResult {
  id: string;
  status: "pending";
  totalPoints: number;
}

/** POST rewardVoucherRefundDecision の decision */
export type RewardVoucherRefundDecision = "approve" | "reject";

/** POST rewardVoucherRefundDecision レスポンス（承認／却下共用・契約 §3.11.3） */
export interface RewardVoucherRefundDecisionResult {
  id: string;
  status: RewardVoucherRefundStatus;
  /** 承認時のみ */
  restoredPoints?: number;
  balancePoints: number;
  /** 承認時のみ（券消費後の在庫スナップショット） */
  rewardVouchers?: RewardVouchers;
}

/** POST pointDebtOffset 送信 1件（契約 §3.11.4・Issue #47） */
export interface PointDebtOffsetItemInput {
  catalogItemId: RewardVoucherCatalogItemId;
  /** 1以上の整数 */
  quantity: number;
}

/** POST pointDebtOffset レスポンス（契約 §3.11.4） */
export interface PointDebtOffsetResult {
  /** 選んだ券の合計穴埋めポイント */
  offsetPoints: number;
  balancePoints: number;
  /** 埋めきれなかった負債（`max(0, -balancePoints)`） */
  remainingDebtPoints: number;
  rewardVouchers: RewardVouchers;
}

/** POST rewardVoucherConsumptions の使用内訳 */
export interface RewardVoucherConsumptionItemInput {
  catalogItemId: PhysicalRewardVoucherCatalogItemId;
  quantity: number;
}

/** GET/POST rewardVoucherConsumptions の保存済み在庫スナップショット */
export interface RewardVoucherConsumptionLineItem
  extends RewardVoucherConsumptionItemInput {
  label: string;
  stockBefore: number;
  stockAfter: number;
}

/** 物理報酬券の使用ログ */
export interface RewardVoucherConsumption {
  operationId: string;
  consumedAt: string;
  items: RewardVoucherConsumptionLineItem[];
}

/** GET rewardVoucherConsumptions */
export interface RewardVoucherConsumptionsData {
  month: string;
  items: RewardVoucherConsumption[];
}

/** POST rewardVoucherConsumptions */
export interface RewardVoucherConsumptionResult
  extends RewardVoucherConsumption {
  idempotentReplay: boolean;
}
