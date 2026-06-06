/**
 * @file Button コンポーネント
 * @description primary / secondary / danger バリアントのタッチ向けボタン。
 */
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** ボタンバリアント */
export type ButtonVariant = "primary" | "secondary" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** @type {ReactNode} ラベル */
  children: ReactNode;
  /** @type {ButtonVariant} 見た目 */
  variant?: ButtonVariant;
  /** @type {boolean} 全幅 */
  fullWidth?: boolean;
}

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:opacity-90",
  secondary: "bg-white text-primary border-2 border-primary hover:bg-primary/5",
  danger: "bg-danger text-white hover:opacity-90",
};

/**
 * タッチ向けボタン
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
        "inline-flex min-h-touch items-center justify-center rounded-default px-6 py-3 text-lg font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
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
