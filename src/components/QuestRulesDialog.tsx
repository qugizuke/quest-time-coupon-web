/**
 * @file QuestRulesDialog
 * @description クエストのルール説明ダイアログ。ポイント制の主要節を子ども向けに表示する
 *   （screen-design.md §8.7 ルールモーダル / Issue #37・正本どおり）。
 */
import { Dialog } from "@/components/ui/Dialog";

/** ルール見出しと箇条書き */
interface RuleSection {
  /** @type {string} 見出し */
  title: string;
  /** @type {string[]} 箇条書き */
  items: string[];
}

const RULE_SECTIONS: RuleSection[] = [
  {
    title: "ポイントの貯まり方",
    items: [
      "できたクエストは 1つ +5pt",
      "時間までに登録できたら +5pt",
      "ぜんぶ達成できた日は +50pt",
    ],
  },
  {
    title: "気をつけること",
    items: [
      "クエストを登録しなかった日は -100pt",
      "採点できないときも -100pt",
      "寝る準備で「できた」と言ったけど本当はできていなかったら -30pt",
    ],
  },
  {
    title: "ポイントとタイマー",
    items: [
      "ポイントはそのままではタイマーに使えません",
      "ママに交換してもらうと Switch・YouTube の時間になります",
      "30分 = 50pt、60分 = 100pt",
      "タイマーは、交換した時間があるときだけ使えます",
    ],
  },
  {
    title: "ポイントの交換",
    items: [
      "ポイントはそのままではタイマーに使えません",
      "交換したいものを選んで申請すると、ママの確認待ちになります",
      "ママが承認したときだけポイントが減り、ごほうびチケットが増えます",
      "Switch 30分券 / 60分券は、タイマー画面で使うとゲーム・YouTube共通の時間になります",
      "おやつ、100円、外食、Switch券は、使わないときにポイントへ戻す申請ができます",
      "ポイントがマイナスのときは、持っているチケットを自分で選んで穴埋めできます",
      "YouTubeだけの交換はありません。Switch時間はゲーム・YouTube共通の時間です",
      "100円などは複数枚まとめて申請できます（例: 500ptで100円×5）",
    ],
  },
];

interface QuestRulesDialogProps {
  /** @type {boolean} 表示中か */
  open: boolean;
  /** @type {() => void} 閉じる */
  onClose: () => void;
}

/**
 * クエストルール説明ダイアログ
 * @param {QuestRulesDialogProps} props - props
 * @returns {JSX.Element} ダイアログ
 */
export function QuestRulesDialog({ open, onClose }: QuestRulesDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="ポイントを貯めよう">
      <div className="flex flex-col gap-5 text-base leading-relaxed">
        <p className="text-gray-800">
          クエストを登録して、ママが確認したあと、
          採点結果を「確認した」するとポイントが増えたり減ったりします。
        </p>
        {RULE_SECTIONS.map((section) => (
          <section key={section.title}>
            <h3 className="mb-2 font-bold text-primary">{section.title}</h3>
            <ul className="list-disc space-y-1 pl-5 text-gray-800">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
