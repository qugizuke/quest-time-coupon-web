/**
 * @file BalanceDisplay
 * @description ポイント残高と Switch/YouTube 時間残高（二財布・ADR-005）を分けて表示する。
 *   負数を丸めず、負債時は色とラベルを変える。タイマー超過ペナルティ表示とは混同しない（超過分は別行で明示）。
 */
import {
  calcDebtMinutes,
  calcIssuableTicketCount,
} from "@/lib/debt";

/**
 * @typedef {object} BalanceDisplayProps
 * @property {number} [balancePoints] - ポイント残高（クエスト確認・未登録・採点拒否・交換消費で増減。0未満にならない）
 * @property {number} switchMinutes - Switch/YouTube 時間残高（負可）
 * @property {number} [penaltyMinutes] - タイマー超過分
 * @property {number} [debtMinutes] - 合算負債（未指定時は算出）
 * @property {number} [penaltyTicketCount] - 未消費のペナルティチケット枚数（常時表示・0枚含む）
 * @property {"child" | "parent"} [audience] - 子ども向け案内の有無
 * @property {boolean} [compact] - ホーム hero 向けの大きめ表示
 */
export interface BalanceDisplayProps {
  /** @type {number} ポイント残高 */
  balancePoints?: number;
  /** @type {number} Switch/YouTube 時間残高（負可） */
  switchMinutes: number;
  /** @type {number} タイマー超過分 */
  penaltyMinutes?: number;
  /** @type {number} 合算負債 */
  debtMinutes?: number;
  /** @type {number} 未消費のペナルティチケット枚数 */
  penaltyTicketCount?: number;
  /** @type {"child" | "parent"} 表示対象 */
  audience?: "child" | "parent";
  /** @type {boolean} hero 向け */
  compact?: boolean;
}

/**
 * ポイント残高・Switch時間残高・負債の可視化
 * @param {BalanceDisplayProps} props - props
 * @returns {JSX.Element} 残高表示
 */
export function BalanceDisplay({
  balancePoints,
  switchMinutes,
  penaltyMinutes = 0,
  debtMinutes: debtMinutesProp,
  penaltyTicketCount = 0,
  audience = "child",
  compact = false,
}: BalanceDisplayProps) {
  const debtMinutes =
    debtMinutesProp ?? calcDebtMinutes(switchMinutes, penaltyMinutes);
  const hasDebt = debtMinutes > 0;
  const issuable = calcIssuableTicketCount(debtMinutes);

  return (
    <div
      className={[
        "flex flex-col gap-3",
        compact ? "items-center text-center" : "items-stretch text-left",
      ].join(" ")}
      data-testid="balance-display"
      data-has-debt={hasDebt ? "true" : "false"}
    >
      {typeof balancePoints === "number" && (
        <div className={compact ? "flex flex-col items-center gap-1" : "flex flex-col gap-1"}>
          <p className="text-sm font-semibold text-ink" data-testid="balance-points">
            いまのポイント: {balancePoints}pt
          </p>
          <p className="text-xs text-muted">
            ポイントを時間に交換してからタイマーを使えます
          </p>
        </div>
      )}

      <div className={compact ? "flex flex-col items-center gap-3" : ""}>
        <p className="text-base text-muted">使える時間</p>
        <p
          className={[
            "flex items-baseline justify-center gap-3",
            hasDebt ? "text-danger" : "text-ink",
          ].join(" ")}
        >
          <span
            className={[
              "font-display leading-none",
              compact ? "text-app-xl" : "text-4xl",
            ].join(" ")}
            data-testid="balance-minutes"
          >
            {switchMinutes}
          </span>
          <span className="text-xl">分</span>
        </p>
        {hasDebt ? (
          <span
            className="rounded-pill bg-danger px-3 py-1 text-xs text-white"
            data-testid="balance-debt-badge"
          >
            負債あり
          </span>
        ) : (
          <span className="rounded-pill bg-primary px-3 py-1 text-xs text-white">
            ごほうびチケット
          </span>
        )}
      </div>

      <p
        className={[
          "text-sm text-muted",
          compact ? "text-center" : "",
        ].join(" ")}
        data-testid="balance-penalty-ticket-count"
      >
        ペナルティチケット: {penaltyTicketCount}枚
      </p>

      {hasDebt && (
        <div
          className={[
            "flex flex-col gap-1 text-sm",
            compact ? "items-center" : "",
          ].join(" ")}
          data-testid="balance-debt-details"
        >
          {penaltyMinutes > 0 && (
            <p className="text-muted" data-testid="balance-penalty-minutes">
              タイマー超過: {penaltyMinutes}分
            </p>
          )}
          <p className="font-semibold text-danger" data-testid="balance-debt-minutes">
            負債合計: {debtMinutes}分
          </p>
          {audience === "child" && (
            <p className="text-muted" data-testid="balance-child-hint">
              保護者にペナルティチケットで精算してもらう
              {issuable > 0 ? `（発行可能: ${issuable}枚）` : ""}
            </p>
          )}
          {audience === "parent" && issuable > 0 && (
            <p className="text-muted">発行可能: {issuable}枚</p>
          )}
        </div>
      )}
    </div>
  );
}
