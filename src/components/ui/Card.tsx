/**
 * @file Card コンポーネント
 * @description 白／クリーム地表＋茶枠のカード（Figma v6: 角丸 24px）。
 */
import type { HTMLAttributes, ReactNode } from "react";

/**
 * @typedef {object} CardProps
 * @property {ReactNode} children - 子要素
 * @property {string} [className] - 追加クラス
 * @property {"default" | "warm" | "hero"} [tone] - 面のトーン
 */
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** @type {ReactNode} 子要素 */
  children: ReactNode;
  /** @type {string} 追加クラス */
  className?: string;
  /** @type {"default" | "warm" | "hero"} 面のトーン */
  tone?: "default" | "warm" | "hero";
}

const toneClass = {
  default: "border-[3px] border-border bg-surface shadow-[var(--shadow-card)]",
  warm: "border-[3px] border-border bg-surface-soft",
  hero: "border-4 border-primary bg-surface-warm",
} as const;

/**
 * カードコンテナ
 * @param {CardProps} props - props
 * @returns {JSX.Element} カード
 */
export function Card({
  children,
  className = "",
  tone = "default",
  ...rest
}: CardProps) {
  return (
    <div
      className={`rounded-card p-6 ${toneClass[tone]} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
