/**
 * @file Banner コンポーネント
 * @description 未確認採点結果などへの誘導バナー（Figma: 青地＋茶枠）。
 */
import type { ReactNode } from "react";

/**
 * @typedef {object} BannerProps
 * @property {ReactNode} children - 内容
 * @property {() => void} [onClick] - クリック時
 * @property {"info" | "warning" | "danger"} [tone] - 状態色
 */
interface BannerProps {
  /** @type {ReactNode} 内容 */
  children: ReactNode;
  /** @type {() => void} クリック時 */
  onClick?: () => void;
  /** @type {"info" | "warning" | "danger"} 状態色 */
  tone?: "info" | "warning" | "danger";
}

const toneClass = {
  info: "border-border bg-info text-white",
  warning: "border-warning bg-warning/15 text-ink",
  danger: "border-danger bg-danger-soft text-danger",
} as const;

/**
 * 警告・お知らせバナー
 * @param {BannerProps} props - props
 * @returns {JSX.Element} バナー
 */
export function Banner({ children, onClick, tone = "info" }: BannerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-default border-[3px] px-4 py-3 text-left text-base font-medium transition-transform duration-200 hover:scale-[1.01]",
        toneClass[tone],
      ].join(" ")}
    >
      {children}
    </button>
  );
}
