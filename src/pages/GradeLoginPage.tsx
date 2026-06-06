/**
 * @file GradeLoginPage
 * @description 保護者採点画面へのパスワード入力。
 *   ブラウザのパスワード保存ポップアップを避けるため type=password は使わない。
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  isGradeAuthed,
  MAX_GRADE_PASSWORD_ATTEMPTS,
  setGradeAuthed,
  verifyGradePassword,
} from "@/lib/gradeAuth";

/**
 * 採点パスワード入力画面
 * @returns {JSX.Element} ページ
 */
export function GradeLoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);

  useEffect(() => {
    if (isGradeAuthed()) {
      navigate("/grade", { replace: true });
    }
  }, [navigate]);

  /**
   * パスワード送信
   * @param {React.FormEvent<HTMLFormElement>} event - submit イベント
   */
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (verifyGradePassword(password)) {
      setGradeAuthed();
      navigate("/grade", { replace: true });
      return;
    }

    const nextAttempts = failedAttempts + 1;
    setFailedAttempts(nextAttempts);
    setPassword("");

    if (nextAttempts >= MAX_GRADE_PASSWORD_ATTEMPTS) {
      navigate("/", { replace: true });
      return;
    }

    setError("パスワードが違います");
  }

  return (
    <AppLayout>
      <h1 className="mb-4 text-app-lg font-bold">採点画面</h1>
      <Card>
        <p className="mb-4 text-muted">パスワードを入力してください</p>
        <form className="flex flex-col gap-4" autoComplete="off" onSubmit={handleSubmit}>
          <input
            type="text"
            name="grade-access-code"
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
            aria-label="採点画面パスワード"
          />
          {error && <p className="text-danger">{error}</p>}
          <Button type="submit" fullWidth disabled={password.length === 0}>
            入室
          </Button>
        </form>
      </Card>
      <Button
        className="mt-6"
        variant="secondary"
        fullWidth
        onClick={() => navigate("/")}
      >
        ホームへ
      </Button>
    </AppLayout>
  );
}
