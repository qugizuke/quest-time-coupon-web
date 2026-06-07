/**
 * @file QuestRulesDialog
 * @description クエスト（ルール）説明ダイアログ。子ども向けの要点を表示する。
 */
import { Dialog } from "@/components/ui/Dialog";
import {
  formatQuestBonusDeadlineLabel,
  formatQuestRegistrationCutoffLabel,
  QUEST_COUNTDOWN_START_HOUR,
  QUEST_COUNTDOWN_START_MINUTE,
} from "@/lib/deadline";

/** ルール見出しと本文 */
interface RuleSection {
  /** @type {string} 見出し */
  title: string;
  /** @type {string[]} 箇条書き */
  items: string[];
}

/**
 * カウントダウン表示開始時刻のラベル（例: "20:00"）
 * @returns {string} HH:MM
 */
function formatCountdownStartLabel(): string {
  const hour = String(QUEST_COUNTDOWN_START_HOUR).padStart(2, "0");
  const minute = String(QUEST_COUNTDOWN_START_MINUTE).padStart(2, "0");
  return `${hour}:${minute}`;
}

/**
 * クエストルール本文（5分単位・現行仕様）
 * @returns {RuleSection[]} セクション一覧
 */
function buildQuestRuleSections(): RuleSection[] {
  const bonusLabel = formatQuestBonusDeadlineLabel();
  const cutoffLabel = formatQuestRegistrationCutoffLabel();
  const countdownStartLabel = formatCountdownStartLabel();

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
        `${bonusLabel} までに登録すると定時ボーナス +15分！`,
        `${cutoffLabel} までなら登録できる（${bonusLabel} 以降はボーナスなし）`,
        `${countdownStartLabel} 以降、まだ始めていないときホームにボーナス締切のタイマーが出る`,
        `${bonusLabel} を過ぎると登録締切のタイマーが出る（赤い表示。${cutoffLabel} まで！）`,
        `${cutoffLabel} を過ぎると「クエスト開始」が押せなくなるよ（-30分）`,
        `${bonusLabel} より前に始めていれば、回答中に時間を過ぎても「登録する」はできる`,
        `ママが採点する前なら、${cutoffLabel} を過ぎても「やり直す」はできる`,
      ],
    },
    {
      title: "時間（クーポン）を増やそう",
      items: [
        "ママが採点したら、結果画面を見て「確認した」を押そう",
        "増えた時間で、Switch や YouTube を楽しもう",
        "うまくいった: +5分。続けて成功すると、もっと増える！",
        "できなかった: -5分。次は「できた」と答えられるようにしよう",
        "嘘（できたと言ったのにできていない）: -15分。いちばん重い減点。正直に答えよう",
      ],
    },
    {
      title: "「分からない」は大きい減点なの？",
      items: [
        "「分からない」は -10分。ママは採点しないけど、自動で減点されるよ",
        "クエストは、その日ちゃんと意識して取り組むことが大切だから",
        "「分からない」は「ちゃんと思い出していない」扱い。嘘ほどではないけど、大きめの減点になる",
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
