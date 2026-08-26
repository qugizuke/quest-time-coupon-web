/**
 * @file QuestRulesDialog
 * @description クエストのルール説明ダイアログ（screen-design.md §8.7 / Figma 62:110）。
 *   要点3カードとアコーディオン4節（加点・ペナルティ・ポイント交換・タイマー）を表示する。
 */
import { Dialog } from "@/components/ui/Dialog";

/** ポイントバッジの色調 */
type BadgeTone = "success" | "danger" | "primary";

/** 要点カード */
interface HighlightCard {
  /** @type {string} 絵文字 */
  icon: string;
  /** @type {string} 見出し */
  title: string;
  /** @type {string} 具体ポイント例 */
  example: string;
  /** @type {string} カード背景クラス */
  cardClass: string;
  /** @type {string} アクセントバーの色クラス */
  accentClass: string;
}

/** ポイント表の行 */
interface PointRow {
  /** @type {string} 説明ラベル */
  label: string;
  /** @type {string} ポイント表記 */
  value: string;
}

/** アコーディオン節 */
interface RuleSection {
  /** @type {string} 絵文字 */
  icon: string;
  /** @type {string} 見出し */
  title: string;
  /** @type {BadgeTone} バッジ色調 */
  badgeTone: BadgeTone;
  /** @type {PointRow[]} ポイント表の行（空なら表なし） */
  rows: PointRow[];
  /** @type {string[]} 補足の箇条書き（空なら箇条書きなし） */
  notes: string[];
}

const HIGHLIGHT_CARDS: HighlightCard[] = [
  {
    icon: "⭐",
    title: "クエストをがんばるとポイントUP",
    example: "できた +5pt ／ 全達成 +50pt",
    cardClass: "bg-success-soft",
    accentClass: "bg-success",
  },
  {
    icon: "⚡",
    title: "登録しないとポイントDOWN",
    example: "未登録 −100pt ／ ウソ −30pt",
    cardClass: "bg-danger-soft",
    accentClass: "bg-danger",
  },
  {
    icon: "🎁",
    title: "ポイントでごほうび交換",
    example: "Switch 30分 = 50pt など",
    cardClass: "bg-info-soft",
    accentClass: "bg-info",
  },
];

const RULE_SECTIONS: RuleSection[] = [
  {
    icon: "📈",
    title: "加点（ポイントが増える）",
    badgeTone: "success",
    rows: [
      { label: "できたクエスト 1つにつき", value: "+5pt" },
      { label: "時間までに登録できたら", value: "+5pt" },
      { label: "ぜんぶ達成できた日は", value: "+50pt" },
    ],
    notes: [],
  },
  {
    icon: "📉",
    title: "ペナルティ（ポイントが減る）",
    badgeTone: "danger",
    rows: [
      { label: "クエストを登録しなかった日", value: "−100pt" },
      { label: "採点拒否になった日", value: "−100pt" },
      { label: "ウソの報告をしたら", value: "−30pt" },
    ],
    notes: [],
  },
  {
    icon: "🔄",
    title: "ポイント交換",
    badgeTone: "primary",
    rows: [
      { label: "Switch 30分券", value: "50pt" },
      { label: "Switch 60分券", value: "100pt" },
    ],
    notes: [
      "ポイントはそのままではタイマーに使えません",
      "交換したいものを選んで申請 → ママが確認",
      "ママが承認するとポイントが減り、チケットが増えます",
      "おやつ・100円・外食・Switch券は返却してポイントに戻せます",
      "ポイントがマイナスのときはチケットで穴埋めできます",
      "100円などは複数枚まとめて申請できます",
    ],
  },
  {
    icon: "⏱️",
    title: "タイマー",
    badgeTone: "primary",
    rows: [],
    notes: [
      "Switch・YouTubeの時間はゲーム・YouTube共通です",
      "ママに交換してもらうとタイマーが使えるようになります",
      "タイマーは交換した時間があるときだけ使えます",
      "YouTubeだけの交換はありません",
    ],
  },
];

const PENALTY_TICKET_MESSAGE =
  "負債があるとき、ママがペナルティチケットを発行して精算してくれるよ。チケットは手伝いのご褒美だよ。";

const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  primary: "bg-primary",
};

const VACATION_TRANSITION_MESSAGE =
  "長期休みが終わる1週間前から、寝る時間は21時に決まるよ。起きる時間も少し早くなるよ。";

interface QuestRulesDialogProps {
  /** @type {boolean} 表示中か */
  open: boolean;
  /** @type {() => void} 閉じる */
  onClose: () => void;
  /** @type {boolean} 長期休み終了前の移行期間か */
  isVacationTransition: boolean;
}

/**
 * クエストルール説明ダイアログ
 * @param {QuestRulesDialogProps} props - props
 * @returns {JSX.Element} ダイアログ
 */
export function QuestRulesDialog({
  open,
  onClose,
  isVacationTransition,
}: QuestRulesDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="クエストのルール"
      showCloseButton
    >
      <div className="flex flex-col gap-4">
        <section
          className="flex flex-col gap-[10px]"
          data-testid="quest-rules-highlight"
        >
          <h3 className="text-[22px] leading-normal text-ink-brand">
            まず覚えよう！ 3つの大事なこと
          </h3>
          {HIGHLIGHT_CARDS.map((card) => (
            <div
              key={card.title}
              className={`flex items-center gap-3 rounded-default px-[14px] py-3 ${card.cardClass}`}
            >
              <span
                className={`w-1 self-stretch rounded-[2px] ${card.accentClass}`}
                aria-hidden="true"
              />
              <span className="text-[22px]" aria-hidden="true">
                {card.icon}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                <p className="text-ink">{card.title}</p>
                <p className="text-[15px] font-bold text-ink-brand-sub">
                  {card.example}
                </p>
              </div>
            </div>
          ))}
        </section>

        <hr className="h-px w-full border-0 bg-border-soft" />

        {RULE_SECTIONS.map((section) => (
          <details
            key={section.title}
            open
            className="rounded-default bg-surface-soft p-[14px]"
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
              <span className="text-app-lg" aria-hidden="true">
                {section.icon}
              </span>
              <h3 className="min-w-0 flex-1 text-ink-brand">
                {section.title}
              </h3>
              <span className="text-[10px] text-muted" aria-hidden="true">
                ▼
              </span>
            </summary>
            <div className="mt-[10px] flex flex-col gap-[10px]">
              {section.rows.length > 0 && (
                <div className="rounded-[12px] bg-white">
                  {section.rows.map((row, index) => (
                    <div
                      key={row.label}
                      className={`flex items-center justify-between gap-2 px-3 py-[10px] ${
                        index > 0 ? "border-t border-border-soft/80" : ""
                      }`}
                    >
                      <p className="text-sm text-ink">{row.label}</p>
                      <span
                        className={`rounded-pill px-[10px] py-1 text-[15px] font-bold text-white ${BADGE_TONE_CLASS[section.badgeTone]}`}
                      >
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {section.notes.length > 0 && (
                <ul className="flex flex-col gap-[6px] text-sm">
                  {section.notes.map((note) => (
                    <li key={note} className="flex gap-1">
                      <span className="text-muted" aria-hidden="true">
                        ・
                      </span>
                      <span className="min-w-0 flex-1 text-ink">{note}</span>
                    </li>
                  ))}
                </ul>
              )}
              {section.title === "ペナルティ（ポイントが減る）" && (
                <p className="rounded-default bg-danger-soft p-3 text-sm text-ink">
                  {PENALTY_TICKET_MESSAGE}
                </p>
              )}
            </div>
          </details>
        ))}

        {isVacationTransition && (
          <p
            className="rounded-default bg-info-soft p-3 text-sm text-ink"
            data-testid="quest-rules-vacation-transition"
          >
            {VACATION_TRANSITION_MESSAGE}
          </p>
        )}
      </div>
    </Dialog>
  );
}
