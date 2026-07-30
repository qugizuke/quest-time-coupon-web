/**
 * @file ParentPasswordModal
 * @description 保護者モード入口のパスワードモーダル（screen-design §5.1 / §5.1.1）。
 *   ブラウザのパスワード保存ポップアップを避けるため type=password は使わない。
 * @limitation 照合はフロント定数のみ。背景は子ども画面ブラー想定（仕様勝ち）。
 */
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  MAX_PARENT_PASSWORD_ATTEMPTS,
  setParentAuthed,
  verifyParentPassword,
} from "@/lib/parentAuth";

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
 * 保護者パスワードモーダル
 * @param {ParentPasswordModalProps} props - props
 * @returns {JSX.Element | null} モーダル
 */
export function ParentPasswordModal({
  open,
  onSuccess,
  onDismiss,
}: ParentPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  if (!open) return null;

  /**
   * パスワード送信
   * @param {React.FormEvent<HTMLFormElement>} event - submit イベント
   * @returns {void}
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (verifyParentPassword(password)) {
      setParentAuthed();
      setPassword("");
      setFailedAttempts(0);
      onSuccess();
      return;
    }

    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);
    setPassword("");

    if (nextAttempts >= MAX_PARENT_PASSWORD_ATTEMPTS) {
      setError(null);
      setFailedAttempts(0);
      onDismiss();
      return;
    }

    setError(
      `パスワードが違います（残り ${MAX_PARENT_PASSWORD_ATTEMPTS - nextAttempts} 回）`,
    );
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
        onClick={onDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="parent-password-title"
        className="relative z-10 flex w-full max-w-md flex-col rounded-card border-4 border-border-soft bg-surface p-6 shadow-[var(--shadow-card)]"
      >
        <h2
          id="parent-password-title"
          className="mb-2 text-app-lg font-bold text-ink"
        >
          保護者モード
        </h2>
        <p className="mb-4 text-muted">パスワードを入力してください</p>
        <form className="flex flex-col gap-4" autoComplete="off" onSubmit={handleSubmit}>
          <input
            type="text"
            name="parent-access-code"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore
            data-form-type="other"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-touch w-full rounded-default border-2 border-primary/30 px-4 py-3 text-lg outline-none focus:border-primary [-webkit-text-security:disc]"
            aria-label="保護者モードパスワード"
          />
          {error && <p className="text-danger">{error}</p>}
          <Button type="submit" fullWidth disabled={password.length === 0}>
            入室
          </Button>
          <Button type="button" fullWidth variant="secondary" onClick={onDismiss}>
            キャンセル
          </Button>
        </form>
      </div>
    </div>
  );
}
