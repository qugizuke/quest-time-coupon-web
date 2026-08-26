/**
 * @file ParentPasswordModal
 * @description 保護者モード入口の PIN モーダル（screen-design §5.1 / §5.1.1、Figma modal-parent-password）。
 *   initial / entering / complete / error / processing の 5 状態を Figma フレームに合わせて描画する。
 *   ブラウザのパスワード保存ポップアップを避けるため type=password は使わない。
 * @limitation 照合はフロント定数のみ。processing はフロント照合のための擬似的な確認時間。
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  MAX_PARENT_PASSWORD_ATTEMPTS,
  setParentAuthed,
  verifyParentPassword,
} from "@/lib/parentAuth";

/** @type {number} PIN 桁数（Figma: 4マス） */
const PIN_LENGTH = 4;

/** @type {number} processing 表示時間（ms）。Figma processing フレーム用の擬似確認時間 */
const PROCESSING_MS = 450;

/**
 * @typedef {object} ParentPasswordModalProps
 * @property {boolean} open - 表示中か
 * @property {() => void} onSuccess - 認証成功時
 * @property {() => void} onDismiss - 閉じる／上限到達時（呼び出し側で遷移）
 */
interface ParentPasswordModalProps {
  /** @type {boolean} 表示中か */
  open: boolean;
  /** @type {() => void} 認証成功時 */
  onSuccess: () => void;
  /** @type {() => void} 閉じる／上限到達時 */
  onDismiss: () => void;
}

/**
 * PIN 1マスの見た目クラスを返す
 * @param {object} params - 判定材料
 * @param {number} params.index - マス位置（0 始まり）
 * @param {number} params.filledCount - 入力済み桁数
 * @param {boolean} params.hasError - エラー表示中か
 * @param {boolean} params.processing - 確認中か
 * @returns {string} クラス名
 */
function pinBoxClass({
  index,
  filledCount,
  hasError,
  processing,
}: {
  index: number;
  filledCount: number;
  hasError: boolean;
  processing: boolean;
}): string {
  const base =
    "flex size-14 items-center justify-center rounded-sm bg-surface";
  if (hasError) {
    return `${base} border-2 border-danger bg-danger-soft`;
  }
  if (processing) {
    return `${base} border-2 border-border opacity-50`;
  }
  // entering: 次に入力するマスを primary 枠で強調（initial では強調なし）
  if (filledCount > 0 && filledCount < PIN_LENGTH && index === filledCount) {
    return `${base} border-[3px] border-primary`;
  }
  return `${base} border-2 border-border`;
}

/**
 * 保護者パスワードモーダル（PIN 4桁）
 * @param {ParentPasswordModalProps} props - props
 * @returns {JSX.Element | null} モーダル
 */
export function ParentPasswordModal({
  open,
  onSuccess,
  onDismiss,
}: ParentPasswordModalProps) {
  const [pin, setPin] = useState("");
  const [processing, setProcessing] = useState(false);
  /** エラー表示中の残り試行回数。null は非エラー */
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(
    null,
  );
  const [failedAttempts, setFailedAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 閉じたら次回表示に向けて全状態を捨てる
  useEffect(() => {
    if (open) return;
    setPin("");
    setProcessing(false);
    setRemainingAttempts(null);
    setFailedAttempts(0);
  }, [open]);

  // 開いたら PIN 入力へフォーカス
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  // processing: 擬似確認時間の後にフロント照合して成否を確定する
  useEffect(() => {
    if (!processing) return;

    const timerId = window.setTimeout(() => {
      setProcessing(false);

      if (verifyParentPassword(pin)) {
        setParentAuthed();
        setPin("");
        setFailedAttempts(0);
        setRemainingAttempts(null);
        onSuccess();
        return;
      }

      const nextAttempts = failedAttempts + 1;
      setPin("");

      if (nextAttempts >= MAX_PARENT_PASSWORD_ATTEMPTS) {
        setFailedAttempts(0);
        setRemainingAttempts(null);
        onDismiss();
        return;
      }

      setFailedAttempts(nextAttempts);
      setRemainingAttempts(MAX_PARENT_PASSWORD_ATTEMPTS - nextAttempts);
    }, PROCESSING_MS);

    return () => window.clearTimeout(timerId);
  }, [processing, pin, failedAttempts, onSuccess, onDismiss]);

  if (!open) return null;

  const hasError = remainingAttempts !== null;
  const complete = pin.length === PIN_LENGTH;
  // error 中は直前に入力した誤りコードを 4 マス分の ● で見せる（Figma error フレーム）
  const filledCount = hasError ? PIN_LENGTH : pin.length;

  /**
   * PIN 入力の変更（数字のみ・4桁まで）
   * @param {React.ChangeEvent<HTMLInputElement>} event - change イベント
   * @returns {void}
   */
  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    setRemainingAttempts(null);
  }

  /**
   * PIN 送信（processing 状態へ移行）
   * @param {React.FormEvent<HTMLFormElement>} event - submit イベント
   * @returns {void}
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!complete || processing) return;
    setRemainingAttempts(null);
    setProcessing(true);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      data-testid="parent-password-modal"
    >
      <button
        type="button"
        className="absolute inset-0 bg-overlay backdrop-blur-sm"
        aria-label="保護者モード入力を閉じる"
        disabled={processing}
        onClick={onDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-password-title"
        aria-busy={processing}
        className="relative z-10 flex w-full max-w-[420px] flex-col gap-4 rounded-card border-4 border-border-soft bg-surface px-6 py-7 shadow-[var(--shadow-card)]"
      >
        <button
          type="button"
          aria-label="閉じる"
          disabled={processing}
          onClick={onDismiss}
          className="absolute right-4 top-3 flex size-8 items-center justify-center rounded-pill text-base text-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          ✕
        </button>
        <div className="flex flex-col items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-9 items-center justify-center rounded-sm bg-primary text-app-lg leading-7"
          >
            🔒
          </span>
          <h2
            id="parent-password-title"
            className="text-center text-app-lg leading-7 text-ink"
          >
            保護者モード
          </h2>
          <p className="text-center text-sm leading-5 text-muted">
            {processing
              ? "コードを確認しています…"
              : "保護者エリアに移動します。4桁のコードを入力してください"}
          </p>
        </div>
        <form
          className="flex flex-col gap-4"
          autoComplete="off"
          onSubmit={handleSubmit}
        >
          <div className="relative">
            <div className="flex items-center justify-center gap-3">
              {Array.from({ length: PIN_LENGTH }, (_, index) => (
                <div
                  key={index}
                  data-testid="pin-box"
                  className={pinBoxClass({
                    index,
                    filledCount,
                    hasError,
                    processing,
                  })}
                >
                  {index < filledCount && (
                    <span className="text-2xl font-bold leading-none text-ink">
                      ●
                    </span>
                  )}
                </div>
              ))}
            </div>
            <input
              ref={inputRef}
              type="text"
              name="parent-access-code"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={PIN_LENGTH}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore
              data-form-type="other"
              value={pin}
              disabled={processing}
              onChange={handleChange}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              aria-label="保護者モードパスワード"
            />
          </div>
          {hasError ? (
            <div className="flex w-full flex-col gap-1 text-center">
              <p className="text-[13px] leading-none text-danger">
                コードが違います。もう一度入力してください
              </p>
              <p className="text-xs leading-4 text-muted">
                残り {remainingAttempts} 回
              </p>
            </div>
          ) : (
            <div className="h-5 w-full" aria-hidden="true" />
          )}
          <div className="flex flex-col gap-3">
            <Button
              type="submit"
              fullWidth
              disabled={!complete || processing}
              className={processing ? "disabled:opacity-100" : ""}
            >
              {processing ? "確認中…" : "入室"}
            </Button>
            <button
              type="button"
              disabled={processing}
              onClick={onDismiss}
              className="flex h-[58px] w-full items-center justify-center text-app-lg leading-7 text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
