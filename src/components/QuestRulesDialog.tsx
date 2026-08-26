/**
 * @file QuestRulesDialog
 * @description クエストのルール説明ダイアログ（screen-design.md §8.7）。
 */
import { Dialog } from "@/components/ui/Dialog";

/** ルール見出しと箇条書き */
interface RuleSection {
  /** @type {string} 見出し */
  title: string;
  /** @type {string[]} 箇条書き */
  items: string[];
}

const HIGHLIGHTS = [
  "クエストをがんばるとポイントUP（できた +5pt / 全達成 +50pt）",
  "登録しないとポイントDOWN（未登録 -100pt / ウソ -30pt）",
  "ポイントでごほうび交換（Switch 30分 = 50pt など）",
] as const;

const RULE_SECTIONS: RuleSection[] = [
  {
    title: "加点（ポイントが増える）",
    items: [
      "できたクエスト 1つにつき +5pt",
      "時間までに登録できたら +5pt",
      "ぜんぶ達成できた日は +50pt",
    ],
  },
  {
    title: "ペナルティ（ポイントが減る）",
    items: [
      "クエストを登録しなかった日は -100pt",
      "採点拒否になった日は -100pt",
      "寝る準備で「できた」と言ったけど本当はできていなかったら -30pt",
    ],
  },
  {
    title: "ポイント交換",
    items: [
      "Switch 30分券 = 50pt、Switch 60分券 = 100pt",
      "ポイントはそのままではタイマーに使えません",
      "交換したいものを選んで申請すると、ママの確認待ちになります",
      "ママが承認したときだけポイントが減り、ごほうびチケットが増えます",
      "おやつ、100円、外食、Switch券は、使わないときにポイントへ戻す申請ができます",
      "ポイントがマイナスのときは、持っているチケットを自分で選んで穴埋めできます",
      "100円などは複数枚まとめて申請できます（例: 500ptで100円×5）",
    ],
  },
  {
    title: "タイマー",
    items: [
      "Switch・YouTube の時間はゲーム・YouTube共通です",
      "Switch 30分券 / 60分券は、タイマー画面で使うと共通時間に加算されます",
      "タイマーは、使える時間があるときだけ使えます",
      "YouTubeだけの交換はありません",
    ],
  },
];

const PENALTY_TICKET_MESSAGE =
  "負債があるとき、ママがペナルティチケットを発行して精算してくれるよ。チケットは手伝いのご褒美だよ。";

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
    <Dialog open={open} onClose={onClose} title="クエストのルール">
      <div className="flex flex-col gap-5 text-base leading-relaxed">
        <section
          className="rounded-default border-[3px] border-primary bg-primary-soft p-4"
          data-testid="quest-rules-highlight"
        >
          <h3 className="mb-2 font-bold text-primary">
            まず覚えよう！ 3つの大事なこと
          </h3>
          <ul className="list-disc space-y-1 pl-5 text-ink">
            {HIGHLIGHTS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        {RULE_SECTIONS.map((section) => (
          <section key={section.title}>
            <h3 className="mb-2 font-bold text-primary">{section.title}</h3>
            <ul className="list-disc space-y-1 pl-5 text-gray-800">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {section.title === "ペナルティ（ポイントが減る）" && (
              <p className="mt-3 rounded-default bg-danger-soft p-3 text-ink">
                {PENALTY_TICKET_MESSAGE}
              </p>
            )}
          </section>
        ))}

        {isVacationTransition && (
          <p
            className="rounded-default bg-info-soft p-3 text-ink"
            data-testid="quest-rules-vacation-transition"
          >
            {VACATION_TRANSITION_MESSAGE}
          </p>
        )}
      </div>
    </Dialog>
  );
}
