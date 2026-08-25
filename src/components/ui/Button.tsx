/**
 * @file Button コンポーネント
 * @description Figma v6 準拠の primary / secondary / success / danger / ghost バリアント。
 * 茶枠＋押し出し影の主 CTA をデフォルトとする（screen-design.md §4.1）。
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** ボタンバリアント */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "success"
  | "danger"
  | "ghost"
  | "navResults"
  | "navRewards"
  | "navTimer";

/**
 * @typedef {object} ButtonProps
 * @property {ReactNode} children - ラベル
 * @property {ButtonVariant} [variant] - 見た目
 * @property {boolean} [fullWidth] - 全幅
 */
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** @type {ReactNode} ラベル */
  children: ReactNode;
  /** @type {ButtonVariant} 見た目 */
  variant?: ButtonVariant;
  /** @type {boolean} 全幅 */
  fullWidth?: boolean;
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border-[3px] border-border bg-primary text-white shadow-[var(--shadow-primary)] hover:brightness-105 active:translate-y-[2px] active:shadow-none",
  secondary:
    "border-[3px] border-border bg-surface text-ink shadow-[var(--shadow-secondary)] hover:bg-surface-soft active:translate-y-[2px] active:shadow-none",
  /** Figma クエスト確認「登録する」など成功系 CTA */
  success:
    "border-[3px] border-border bg-success text-white shadow-[var(--shadow-success)] hover:brightness-105 active:translate-y-[2px] active:shadow-none",
  danger:
    "border-[3px] border-border bg-danger text-white shadow-[var(--shadow-danger)] hover:brightness-105 active:translate-y-[2px] active:shadow-none",
  ghost:
    "border border-border-chip bg-chip text-chip-ink hover:bg-surface-warm",
  /** Figma ホーム「採点結果をみる」 */
  navResults:
    "border-0 bg-nav-results text-success-deep hover:brightness-95",
  /** ホーム「ポイントを交換する」（Issue #38） */
  navRewards: "border-0 bg-nav-rewards text-ink-brand hover:brightness-95",
  /** Figma ホーム「タイマーをスタート」 */
  navTimer: "border-0 bg-nav-timer text-timer-ink hover:brightness-95",
};

/**
 * タッチ向けボタン（Figma 全寄せ土台）
 * @param {ButtonProps} props - ボタン props
 * @returns {JSX.Element} ボタン
 */
export function Button({
  children,
  variant = "primary",
  fullWidth = false,
  className = "",
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        "inline-flex min-h-touch items-center justify-center rounded-default px-6 py-3 text-lg font-semibold transition-[transform,box-shadow,filter] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none",
        variantClass[variant],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
