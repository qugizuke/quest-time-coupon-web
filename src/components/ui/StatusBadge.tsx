/**
 * @file StatusBadge コンポーネント
 * @description 採点日ステータス等のピル表示土台（Figma 保護者ホームの状態チップ準拠）。
 */
import type { ReactNode } from "react";

/** ステータス種別 */
export type StatusBadgeTone =
  | "success"
  | "info"
  | "warning"
  | "danger"
  | "muted";

/**
 * @typedef {object} StatusBadgeProps
 * @property {ReactNode} children - ラベル
 * @property {StatusBadgeTone} [tone] - 色
 */
interface StatusBadgeProps {
  /** @type {ReactNode} ラベル */
  children: ReactNode;
  /** @type {StatusBadgeTone} 色 */
  tone?: StatusBadgeTone;
}

const toneClass: Record<StatusBadgeTone, string> = {
  success: "bg-success-soft text-success",
  info: "bg-info-soft text-info",
  warning: "border border-warning bg-surface-warm text-warning",
  danger: "border border-danger bg-danger-soft text-danger",
  muted: "bg-muted-soft text-muted-strong",
};

/**
 * ステータスピル
 * @param {StatusBadgeProps} props - props
 * @returns {JSX.Element} バッジ
 */
export function StatusBadge({ children, tone = "muted" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-3 py-1 text-xs font-medium ${toneClass[tone]}`}
    >
      {children}
    </span>
  );
}
