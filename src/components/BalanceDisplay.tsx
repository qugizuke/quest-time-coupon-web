/**
 * @file BalanceDisplay
 * @description ご褒美残高の表示。負数を丸めず、負債時は色とラベルを変える。
 *   タイマー超過ペナルティ表示とは混同しない（超過分は別行で明示）。
 */
import {
  calcDebtMinutes,
  calcIssuableTicketCount,
} from "@/lib/debt";

/**
 * @typedef {object} BalanceDisplayProps
 * @property {number} balanceMinutes - ご褒美残高（負可）
 * @property {number} [penaltyMinutes] - タイマー超過分
 * @property {number} [debtMinutes] - 合算負債（未指定時は算出）
 * @property {"child" | "parent"} [audience] - 子ども向け案内の有無
 * @property {boolean} [compact] - ホーム hero 向けの大きめ表示
 */
export interface BalanceDisplayProps {
  /** @type {number} ご褒美残高（負可） */
  balanceMinutes: number;
  /** @type {number} タイマー超過分 */
  penaltyMinutes?: number;
  /** @type {number} 合算負債 */
  debtMinutes?: number;
  /** @type {"child" | "parent"} 表示対象 */
  audience?: "child" | "parent";
  /** @type {boolean} hero 向け */
  compact?: boolean;
}

/**
 * ご褒美残高・負債の可視化
 * @param {BalanceDisplayProps} props - props
 * @returns {JSX.Element} 残高表示
 */
export function BalanceDisplay({
  balanceMinutes,
  penaltyMinutes = 0,
  debtMinutes: debtMinutesProp,
  audience = "child",
  compact = false,
}: BalanceDisplayProps) {
  const debtMinutes =
    debtMinutesProp ?? calcDebtMinutes(balanceMinutes, penaltyMinutes);
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
      <div className={compact ? "flex flex-col items-center gap-3" : ""}>
        <p className="text-base text-muted">ご褒美時間</p>
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
            {balanceMinutes}
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
