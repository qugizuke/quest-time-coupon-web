/**
 * @file Dialog コンポーネント
 * @description モーダル枠（オーバーレイ・Esc・閉じる）。Figma の茶枠カードに寄せる。
 */
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

/**
 * @typedef {object} DialogProps
 * @property {boolean} open - 表示中か
 * @property {() => void} onClose - 閉じる
 * @property {string} title - タイトル
 * @property {ReactNode} [titleIcon] - タイトル先頭のアイコン
 * @property {ReactNode} children - 本文
 */
interface DialogProps {
  /** @type {boolean} 表示中か */
  open: boolean;
  /** @type {() => void} 閉じる */
  onClose: () => void;
  /** @type {string} タイトル */
  title: string;
  /** @type {ReactNode} タイトル先頭のアイコン */
  titleIcon?: ReactNode;
  /** @type {ReactNode} 本文 */
  children: ReactNode;
}

/**
 * モーダルダイアログ
 * @param {DialogProps} props - props
 * @returns {JSX.Element | null} ダイアログ
 */
export function Dialog({
  open,
  onClose,
  title,
  titleIcon,
  children,
}: DialogProps) {
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
        className="absolute inset-0 bg-overlay backdrop-blur-sm"
        aria-label="ダイアログを閉じる"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-card border-4 border-border-soft bg-surface shadow-[var(--shadow-card)]"
      >
        <div className="border-b border-border-soft px-4 py-3">
          <div className="flex items-center gap-2">
            {titleIcon}
            <h2
              id="dialog-title"
              className={`text-app-lg text-ink ${titleIcon ? "" : "font-bold"}`}
            >
              {title}
            </h2>
          </div>
        </div>
        <div className="overflow-y-auto px-4 py-4 text-ink">{children}</div>
        <div className="border-t border-border-soft px-4 py-3">
          <Button fullWidth variant="secondary" onClick={onClose}>
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
}
