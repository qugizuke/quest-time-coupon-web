/**
 * @file QuestRulesDialog
 * @description クエスト（ルール）説明ダイアログ。子ども向けの要点を表示する（v5 仕様）。
 */
import { useMemo } from "react";
import { Dialog } from "@/components/ui/Dialog";
import {
  formatQuestBonusDeadlineLabel,
  formatQuestRegistrationCutoffLabel,
  formatQuestRegistrationStartLabel,
} from "@/lib/deadline";
import { todayLocal } from "@/lib/date";
import type { BedtimeHour } from "@/types/api";

/** ルール見出しと本文 */
interface RuleSection {
  /** @type {string} 見出し */
  title: string;
  /** @type {string[]} 箇条書き */
  items: string[];
}

/**
 * クエストルール本文（5分単位・v5 仕様）
 * @param {BedtimeHour} bedtimeHour - 就寝時刻（時）
 * @param {boolean} isRestDayEve - 休日前日か
 * @returns {RuleSection[]} セクション一覧
 */
function buildQuestRuleSections(
  bedtimeHour: BedtimeHour,
  isRestDayEve: boolean,
): RuleSection[] {
  const today = todayLocal();
  const startLabel = formatQuestRegistrationStartLabel(bedtimeHour);
  const bonusLabel = formatQuestBonusDeadlineLabel(today, bedtimeHour);
  const cutoffLabel = formatQuestRegistrationCutoffLabel(bedtimeHour);
  const bedtimeLabel = formatQuestRegistrationCutoffLabel(bedtimeHour);

  const registrationItems = isRestDayEve
    ? [
        "休日前日は「今日の寝る時間」を選べる（21:00 / 22:00 / 23:00）",
        `受付は ${startLabel}〜${cutoffLabel}（寝る時間の1時間前から）`,
        `${bonusLabel} までに登録すると定時ボーナス +15分！（寝る時間の30分前まで）`,
      ]
    : [
        `受付は ${startLabel}〜${cutoffLabel}（寝る時間 ${bedtimeLabel} の1時間前から）`,
        `${bonusLabel} までに登録すると定時ボーナス +15分！（寝る時間の30分前まで）`,
      ];

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
        ...registrationItems,
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

interface QuestRulesDialogProps {
  /** @type {boolean} 表示中か */
  open: boolean;
  /** @type {() => void} 閉じる */
  onClose: () => void;
  /** @type {BedtimeHour} 就寝時刻（時） */
  bedtimeHour?: BedtimeHour;
  /** @type {boolean} 休日前日か */
  isRestDayEve?: boolean;
}

/**
 * クエストルール説明ダイアログ
 * @param {QuestRulesDialogProps} props - props
 * @returns {JSX.Element} ダイアログ
 */
export function QuestRulesDialog({
  open,
  onClose,
  bedtimeHour = 21,
  isRestDayEve = false,
}: QuestRulesDialogProps) {
  const sections = useMemo(
    () => buildQuestRuleSections(bedtimeHour, isRestDayEve),
    [bedtimeHour, isRestDayEve],
  );

  return (
    <Dialog open={open} onClose={onClose} title="クエストのルール">
      <div className="flex flex-col gap-5 text-base leading-relaxed">
        {sections.map((section) => (
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
