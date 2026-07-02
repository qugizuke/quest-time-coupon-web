/**
 * @file QuestRegistrationCutoffCountdown
 * @description 未着手時、20:30 以降に登録受付締切（21:00）までのカウントダウンを表示する。
 *   未登録ペナルティ（-30分）を赤文字で知らせる。
 */

/** 表示用 props */
interface QuestRegistrationCutoffCountdownProps {
  /** @type {string} MM:SS 形式の残り時間 */
  countdownFormatted: string;
  /** @type {string} 登録受付締切ラベル（例: "21:00"） */
  registrationCutoffLabel: string;
}

/**
 * 登録受付締切カウントダウン（ペナルティ警告）
 * @param {QuestRegistrationCutoffCountdownProps} props - props
 * @returns {JSX.Element} カウントダウン表示
 */
export function QuestRegistrationCutoffCountdown({
  countdownFormatted,
  registrationCutoffLabel,
}: QuestRegistrationCutoffCountdownProps) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-default border-2 border-danger bg-danger/10 px-4 py-4 text-center"
      role="timer"
      aria-live="polite"
      aria-label={`登録締切 ${registrationCutoffLabel} まであと ${countdownFormatted}。過ぎると60分減点`}
    >
      <p className="text-base font-bold text-danger">
        登録を忘れると -60分！
      </p>
      <p className="text-app-xl font-bold tabular-nums text-danger">
        {countdownFormatted}
      </p>
      <p className="text-sm font-medium text-danger">
        {registrationCutoffLabel} までに「クエスト開始」して登録しよう
      </p>
      <p className="text-sm text-danger/80">
        ボーナス（+15分）の時間は過ぎました
      </p>
    </div>
  );
}
