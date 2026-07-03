/**
 * @file QuestDeadlineCountdown
 * @description 未着手時、受付開始以降に定時ボーナス締切までのカウントダウンを表示する。
 */

/** 表示用 props */
interface QuestDeadlineCountdownProps {
  /** @type {string} MM:SS 形式の残り時間 */
  countdownFormatted: string;
  /** @type {string} ボーナス締切ラベル（例: "20:30"） */
  bonusDeadlineLabel: string;
}

/**
 * 定時ボーナス締切カウントダウン
 * @param {QuestDeadlineCountdownProps} props - props
 * @returns {JSX.Element} カウントダウン表示
 */
export function QuestDeadlineCountdown({
  countdownFormatted,
  bonusDeadlineLabel,
}: QuestDeadlineCountdownProps) {
  return (
    <div
      className="flex flex-col items-center gap-1 rounded-default border-2 border-warning bg-warning/15 px-4 py-4 text-center"
      role="timer"
      aria-live="polite"
      aria-label={`定時ボーナス締切 ${bonusDeadlineLabel} まであと ${countdownFormatted}`}
    >
      <p className="text-base font-bold text-gray-900">定時ボーナス（+15分）まで</p>
      <p className="text-app-xl font-bold tabular-nums text-primary">{countdownFormatted}</p>
      <p className="text-sm text-muted">
        {bonusDeadlineLabel} までに「クエスト開始」して登録しよう
      </p>
    </div>
  );
}
