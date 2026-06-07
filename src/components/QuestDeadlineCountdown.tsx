/**
 * @file QuestDeadlineCountdown
 * @description 未着手時、20:00 以降に登録締切（20:30）までのカウントダウンを表示する。
 */

/** 表示用 props */
interface QuestDeadlineCountdownProps {
  /** @type {string} MM:SS 形式の残り時間 */
  countdownFormatted: string;
  /** @type {string} 締切ラベル（例: "20:30"） */
  deadlineLabel: string;
}

/**
 * 登録締切カウントダウン
 * @param {QuestDeadlineCountdownProps} props - props
 * @returns {JSX.Element} カウントダウン表示
 */
export function QuestDeadlineCountdown({
  countdownFormatted,
  deadlineLabel,
}: QuestDeadlineCountdownProps) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-default border-2 border-warning bg-warning/15 px-4 py-4 text-center"
      role="timer"
      aria-live="polite"
      aria-label={`登録締切 ${deadlineLabel} まであと ${countdownFormatted}`}
    >
      <p className="text-base font-bold text-gray-900">クエスト開始の締切まで</p>
      <p className="text-app-xl font-bold tabular-nums text-primary">{countdownFormatted}</p>
      <p className="text-sm text-muted">
        {deadlineLabel} までに「クエスト開始」を押そう（定時登録で +15分！）
      </p>
    </div>
  );
}
