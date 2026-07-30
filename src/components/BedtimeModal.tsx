/**
 * @file BedtimeModal
 * @description 就寝時刻選択モーダル（独立パスなし・screen-design §6.2）。
 *   選択肢は 21 / 22 / 23 のみ。本接続は後続 Issue。
 */
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import type { BedtimeHour } from "@/types/api";

/** 就寝候補 */
const BEDTIME_OPTIONS: { value: BedtimeHour; label: string }[] = [
  { value: 21, label: "21時" },
  { value: 22, label: "22時" },
  { value: 23, label: "23時" },
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
      <div className="flex flex-col gap-3" data-testid="bedtime-modal">
        {BEDTIME_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            fullWidth
            variant={selectedHour === opt.value ? "primary" : "secondary"}
            disabled={disabled}
            onClick={() => {
              onSelect(opt.value);
              onClose();
            }}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </Dialog>
  );
}
