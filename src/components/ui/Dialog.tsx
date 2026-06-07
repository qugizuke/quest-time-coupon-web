/**
 * @file Dialog コンポーネント
 * @description モーダルダイアログ。オーバーレイクリック・Esc・閉じるボタンで閉じる。
 */
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

interface DialogProps {
  /** @type {boolean} 表示中か */
  open: boolean;
  /** @type {() => void} 閉じる */
  onClose: () => void;
  /** @type {string} タイトル */
  title: string;
  /** @type {ReactNode} 本文 */
  children: ReactNode;
}

/**
 * モーダルダイアログ
 * @param {DialogProps} props - props
 * @returns {JSX.Element | null} ダイアログ
 */
export function Dialog({ open, onClose, title, children }: DialogProps) {
  useEffect(() => {
    if (!open) return;

    /** @param {KeyboardEvent} event - キー入力 */
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="ダイアログを閉じる"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-default bg-white shadow-lg"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <h2 id="dialog-title" className="text-app-lg font-bold">
            {title}
          </h2>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
        <div className="border-t border-gray-200 px-4 py-3">
          <Button fullWidth variant="secondary" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
}
