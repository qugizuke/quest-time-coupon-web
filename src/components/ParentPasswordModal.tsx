/**
 * @file ParentPasswordModal
 * @description 保護者モード入口の PIN モーダル（screen-design §5.1 / §5.1.1、Figma modal-parent-password）。
 *   initial / entering / complete / error / processing の 5 状態を Figma フレームに合わせて描画する。
 *   ブラウザのパスワード保存ポップアップを避けるため type=password は使わない。
 * @limitation 照合はサーバ（Cloud Functions `parentLogin`）のみ。フロントには
 *   パスワードも照合ロジックも持たない。試行制限はサーバ側が正で、
 *   画面は 401（不一致）と 429（上限）を区別して表示するだけ。
 */
import { useEffect, useRef, useState } from "react";
import { ApiError, postParentLogin } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { setParentSession } from "@/lib/parentAuth";

/** @type {number} PIN 桁数（Figma: 4マス） */
const PIN_LENGTH = 4;

/** ログイン失敗の種類 */
type LoginErrorKind = "invalid" | "rateLimited" | "unavailable";

/** ログイン失敗の表示内容 */
interface LoginError {
  /** 失敗の種類 */
  kind: LoginErrorKind;
  /** 429 の Retry-After（秒）。無いときは null */
  retryAfterSeconds: number | null;
}

/**
 * @typedef {object} ParentPasswordModalProps
 * @property {boolean} open - 表示中か
 * @property {() => void} onSuccess - 認証成功時
 * @property {() => void} onDismiss - 閉じる／キャンセル時（呼び出し側で遷移）
 */
interface ParentPasswordModalProps {
  /** @type {boolean} 表示中か */
  open: boolean;
  /** @type {() => void} 認証成功時 */
  onSuccess: () => void;
  /** @type {() => void} 閉じる／キャンセル時（呼び出し側で遷移） */
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
 * ログイン失敗の説明文を組み立てる
 * @param {LoginError} error - 失敗内容
 * @returns {string} 画面表示用の文言
 */
function loginErrorMessage(error: LoginError): string {
  if (error.kind === "rateLimited") {
    const waitMinutes =
      error.retryAfterSeconds !== null
        ? Math.max(1, Math.ceil(error.retryAfterSeconds / 60))
        : null;
    return waitMinutes !== null
      ? `試行回数が上限に達しました。約${waitMinutes}分後に再度お試しください`
      : "試行回数が上限に達しました。しばらく待ってから再度お試しください";
  }
  if (error.kind === "invalid") {
    return "コードが違います。もう一度入力してください";
  }
  return "ログインできませんでした。通信環境を確認してください";
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
  const [error, setError] = useState<LoginError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 閉じたら次回表示に向けて全状態を捨てる
  useEffect(() => {
    if (open) return;
    setPin("");
    setProcessing(false);
    setError(null);
  }, [open]);

  // 開いたら PIN 入力へフォーカス
  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  if (!open) return null;

  const hasError = error !== null;
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
    setError(null);
  }

  /**
   * PIN をサーバへ送って照合する
   * @param {React.FormEvent<HTMLFormElement>} event - submit イベント
   * @returns {Promise<void>} 完了時に resolve
   */
  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (!complete || processing) return;

    setError(null);
    setProcessing(true);
    try {
      const result = await postParentLogin({ pin });
      setParentSession({
        token: result.token,
        expiresAt: result.expiresAt,
      });
      setPin("");
      setProcessing(false);
      onSuccess();
    } catch (cause) {
      setPin("");
      setProcessing(false);
      if (cause instanceof ApiError && cause.code === "RATE_LIMITED") {
        setError({
          kind: "rateLimited",
          retryAfterSeconds: cause.retryAfterSeconds,
        });
        return;
      }
      if (cause instanceof ApiError && cause.code === "INVALID_CREDENTIALS") {
        setError({ kind: "invalid", retryAfterSeconds: null });
        return;
      }
      setError({ kind: "unavailable", retryAfterSeconds: null });
    }
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
          {error !== null ? (
            <div className="flex w-full flex-col gap-1 text-center">
              <p className="text-[13px] leading-none text-danger">
                {loginErrorMessage(error)}
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
