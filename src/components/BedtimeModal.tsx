/**
 * @file BedtimeModal
 * @description 就寝時刻選択モーダル（独立パスなし・screen-design §6.2）。
 *   選択肢は 21 / 22 / 23 のみ。チップ見た目は Figma 流用、入口はモーダル（仕様勝ち D2）。
 */
import checkIcon from "@/assets/check-white.svg";
import moonIcon from "@/assets/moon.svg";
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
 * @property {boolean} [processing] - 保存処理中
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
  /** @type {boolean} 保存処理中 */
  processing?: boolean;
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
  processing = false,
}: BedtimeModalProps) {
  const choicesDisabled = disabled || processing;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="今日の寝る時間を設定する"
      titleIcon={<img src={moonIcon} alt="" className="size-6 shrink-0" />}
    >
      <div
        className="flex flex-col gap-4"
        data-testid="bedtime-modal"
        aria-busy={processing}
      >
        <p className="text-sm leading-5 text-muted">
          {processing ? "保存しています…" : "寝る時間を選んでね"}
        </p>
        <div className="flex gap-3" data-testid="bedtime-choices">
          {BEDTIME_OPTIONS.map((opt) => {
            const selected = selectedHour === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                disabled={choicesDisabled}
                onClick={() => onSelect(opt.value)}
                className={[
                  "relative flex h-[72px] min-w-0 flex-1 items-center justify-center rounded-default border-2 text-xl leading-6 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  selected
                    ? "border-primary bg-primary text-white"
                    : "border-border bg-surface text-ink hover:bg-surface-soft",
                ].join(" ")}
              >
                {opt.label}
                {selected && (
                  <img
                    src={checkIcon}
                    alt=""
                    className="absolute right-2.5 top-2.5 size-4"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}
