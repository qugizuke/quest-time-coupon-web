/**
 * @file Card コンポーネント
 */
import type { ReactNode } from "react";

interface CardProps {
  /** @type {ReactNode} 子要素 */
  children: ReactNode;
  /** @type {string} 追加クラス */
  className?: string;
}

/**
 * カードコンテナ
 * @param {CardProps} props - props
 * @returns {JSX.Element} カード
 */
export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-default bg-white p-6 shadow-sm ${className}`.trim()}
    >
      {children}
    </div>
  );
}
