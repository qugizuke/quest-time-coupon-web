/**
 * @file BedtimeModal
 * @description 就寝時刻選択モーダル（独立パスなし・screen-design §6.2）。
 *   選択肢は 21 / 22 / 23 のみ。チップ見た目は Figma 流用、入口はモーダル（仕様勝ち D2）。
 */
import { Dialog } from "@/components/ui/Dialog";
import type { BedtimeHour } from "@/types/api";

/** 就寝候補（表示は HH:00） */
const BEDTIME_OPTIONS: { value: BedtimeHour; label: string }[] = [
  { value: 21, label: "21:00" },
  { value: 22, label: "22:00" },
  { value: 23, label: "23:00" },
];

/**
 * @typedef {object} BedtimeModalProps
 * @property {boolean} open - 表示中か
 * @property {() => void} onClose - 閉じる
 * @property {BedtimeHour | undefined} selectedHour - 選択中の時刻
 * @property {(hour: BedtimeHour) => void} onSelect - 時刻選択
 * @property {boolean} [disabled] - 選択不可
 */
interface BedtimeModalProps {
  /** @type {boolean} 表示中か */
  open: boolean;
  /** @type {() => void} 閉じる */
  onClose: () => void;
  /** @type {BedtimeHour | undefined} 選択中の時刻 */
  selectedHour: BedtimeHour | undefined;
  /** @type {(hour: BedtimeHour) => void} 時刻選択 */
  onSelect: (hour: BedtimeHour) => void;
  /** @type {boolean} 選択不可 */
  disabled?: boolean;
}

/**
 * 就寝設定モーダル
 * @param {BedtimeModalProps} props - props
 * @returns {JSX.Element | null} モーダル
 */
export function BedtimeModal({
  open,
  onClose,
  selectedHour,
  onSelect,
  disabled = false,
}: BedtimeModalProps) {
  return (
    <Dialog open={open} onClose={onClose} title="今日の寝る時間を設定する">
      <div className="flex flex-col gap-4" data-testid="bedtime-modal">
        <p className="text-sm text-muted">🛏️ 寝る時間を選んでね（21 / 22 / 23）</p>
        <div className="flex gap-3">
          {BEDTIME_OPTIONS.map((opt) => {
            const selected = selectedHour === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSelect(opt.value);
                  onClose();
                }}
                className={[
                  "flex min-h-touch flex-1 items-center justify-center rounded-default text-base transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  selected
                    ? "border-[3px] border-info bg-info-soft text-info"
                    : "border-2 border-border bg-surface text-ink hover:bg-surface-soft",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
