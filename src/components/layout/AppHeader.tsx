/**
 * @file AppHeader
 * @description 子ども／保護者共通ヘッダー土台（ブランド・ホーム・長期休みバッジ・保護者モード）。
 * mode に応じて枠・ブランド文字・アクション色までヘッダー全体のパレットを切り替える。
 * 後続 Issue A で導線（ParentGuard・モーダル）を接続する。
 */
import type { ReactNode } from "react";

/**
 * @typedef {object} AppHeaderProps
 * @property {boolean} [showHome] - ホームボタン表示
 * @property {boolean} [vacationMode] - 長期休みモードバッジ
 * @property {"kid" | "parent"} [mode] - ヘッダー面
 * @property {() => void} [onHome] - ホーム押下
 * @property {() => void} [onParentMode] - 保護者モード押下
 * @property {() => void} [onExitParentMode] - 保護者モード終了
 * @property {ReactNode} [trailing] - 右端追加要素
 */
interface AppHeaderProps {
  /** @type {boolean} ホームボタン表示 */
  showHome?: boolean;
  /** @type {boolean} 長期休みモードバッジ */
  vacationMode?: boolean;
  /** @type {"kid" | "parent"} ヘッダー面 */
  mode?: "kid" | "parent";
  /** @type {() => void} ホーム押下 */
  onHome?: () => void;
  /** @type {() => void} 保護者モード押下 */
  onParentMode?: () => void;
  /** @type {() => void} 保護者モード終了 */
  onExitParentMode?: () => void;
  /** @type {ReactNode} 右端追加要素 */
  trailing?: ReactNode;
}

/**
 * 共通ヘッダー（見た目土台のみ。認証は後続 Issue）
 * @param {AppHeaderProps} props - props
 * @returns {JSX.Element} ヘッダー
 */
export function AppHeader({
  showHome = false,
  vacationMode = false,
  mode = "kid",
  onHome,
  onParentMode,
  onExitParentMode,
  trailing,
}: AppHeaderProps) {
  const isParent = mode === "parent";
  const barClass = isParent
    ? "border-border-parent-soft bg-bg-parent-header"
    : vacationMode
      ? "border-border-soft bg-bg-vacation-header"
      : "border-border-soft bg-bg-header";
  const brandClass = isParent ? "text-ink-brand-parent" : "text-ink-brand";
  const brandSubClass = isParent
    ? "text-ink-brand-parent-sub"
    : "text-ink-brand-sub";

  return (
    <header
      className={`flex h-16 w-full items-center gap-3 border px-4 sm:px-7 ${barClass}`}
    >
      <div
        className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-primary text-lg text-white"
        aria-hidden
      >
        ★
      </div>
      <div className="min-w-0">
        <p className={`truncate text-base leading-tight ${brandClass}`}>
          クエストタイム
        </p>
        <p className={`truncate text-[9px] leading-tight ${brandSubClass}`}>
          Quest Time Coupon
        </p>
      </div>

      {showHome && (
        <button
          type="button"
          onClick={onHome}
          className="rounded-sm border border-border-chip bg-chip px-3 py-1.5 text-xs text-chip-ink"
        >
          🏠 ホーム
        </button>
      )}

      {vacationMode && !isParent && (
        <span className="rounded-pill bg-vacation-badge px-3 py-1.5 text-xs text-white">
          🏖️ 長期休みモード
        </span>
      )}

      <div className="flex-1" />

      {trailing}

      {isParent ? (
        <button
          type="button"
          onClick={onExitParentMode}
          className="rounded-sm border border-border-parent-chip bg-parent-chip px-3 py-1.5 text-xs text-parent-chip-ink"
        >
          🔓 保護者モードを終了
        </button>
      ) : (
        <button
          type="button"
          onClick={onParentMode}
          className="rounded-sm border border-border-chip bg-chip px-3.5 py-2 text-xs text-chip-ink"
        >
          🔒 保護者モード
        </button>
      )}
    </header>
  );
}
