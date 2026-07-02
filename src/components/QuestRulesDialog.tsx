/**
 * @file QuestRulesDialog
 * @description クエスト（ルール）説明ダイアログ。子ども向けの要点を表示する（v5 仕様）。
 */
import { Dialog } from "@/components/ui/Dialog";
import {
  formatQuestBonusDeadlineLabel,
  formatQuestRegistrationCutoffLabel,
} from "@/lib/deadline";
import { todayLocal } from "@/lib/date";

/** ルール見出しと本文 */
interface RuleSection {
  /** @type {string} 見出し */
  title: string;
  /** @type {string[]} 箇条書き */
  items: string[];
}

/**
 * クエストルール本文（5分単位・v5 仕様）
 * @returns {RuleSection[]} セクション一覧
 */
function buildQuestRuleSections(): RuleSection[] {
  const today = todayLocal();
  const bonusLabel = formatQuestBonusDeadlineLabel(today);
  const cutoffLabel = formatQuestRegistrationCutoffLabel();

  return [
    {
      title: "毎日のクエスト",
      items: [
        "決まったクエストを見て、1問ずつ答えよう",
        "「できた」「できなかった」で、正直に答えよう",
        "全部終わったら、最後に「登録する」を押そう",
        "間違えたら、ママが採点する前にやり直そう",
      ],
    },
    {
      title: "クエスト登録の時間",
      items: [
        `平日は ${bonusLabel} までに登録すると定時ボーナス +15分！（${cutoffLabel} まで受付）`,
        "休日前日は「今日の寝る時間」を選べる（21:00 / 22:00 / 23:00）",
        "寝る時間の30分前までに登録すると +15分！",
        "1問目「寝る準備は終わっていますか？」に「できなかった」と答えた日は、時間内でも +15分 は付かない",
        `${cutoffLabel} を過ぎると「クエスト開始」が押せなくなるよ（-60分）`,
        "ママが採点する前なら、締切を過ぎても「やり直す」はできる",
      ],
    },
    {
      title: "時間（クーポン）を増やそう",
      items: [
        "ママが採点したら、結果画面を見て「確認した」を押そう",
        "増えた時間で、Switch や YouTube を楽しもう",
        "うまくいった: +5分。続けて成功すると、もっと増える！",
        "できなかった: -5分。次は「できた」と答えられるようにしよう",
        "嘘（できたと言ったのにできていない）: -10分。正直に答えよう",
      ],
    },
    {
      title: "「分からない」は大きい減点なの？",
      items: [
        "「分からない」は -10分。ママは採点しないけど、自動で減点されるよ",
        "クエストは、その日ちゃんと意識して取り組むことが大切だから",
        "できたかどうか、少し考えてから「できた」「できなかった」で答えよう",
      ],
    },
    {
      title: "タイマーの使い方",
      items: [
        "タイマーをスタートして、遊ぶ時間をはかろう",
        "使った時間だけ、残り時間が減る",
        "0分になったらスタートできない。残りを見ながら遊ぼう",
        "時間を使いすぎないように、ストップを忘れないでね",
      ],
    },
  ];
}

/** クエストルール本文 */
const QUEST_RULE_SECTIONS = buildQuestRuleSections();

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
    <Dialog open={open} onClose={onClose} title="クエストのルール">
      <div className="flex flex-col gap-5 text-base leading-relaxed">
        {QUEST_RULE_SECTIONS.map((section) => (
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
