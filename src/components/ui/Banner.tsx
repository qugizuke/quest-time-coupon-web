/**
 * @file Banner コンポーネント
 */
import type { ReactNode } from "react";

interface BannerProps {
  /** @type {ReactNode} 内容 */
  children: ReactNode;
  /** @type {() => void} クリック時 */
  onClick?: () => void;
}

/**
 * 警告・お知らせバナー
 * @param {BannerProps} props - props
 * @returns {JSX.Element} バナー
 */
export function Banner({ children, onClick }: BannerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-default border-2 border-warning bg-warning/20 px-4 py-3 text-left text-base font-medium text-gray-900 transition-transform duration-200 hover:scale-[1.01]"
    >
      {children}
    </button>
  );
}
