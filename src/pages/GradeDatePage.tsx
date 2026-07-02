/**
 * @file GradeDatePage
 * @description 保護者が1日分を採点する画面（任意加減点対応）。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { postGrade } from "@/api/client";
import { gradeQuery, queryKeys } from "@/api/queries";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { formatDateJa } from "@/lib/date";
import { childAnswerLabel, isUnknownChildAnswer } from "@/lib/labels";
import type {
  AdjustmentCode,
  AdjustmentDefinition,
  AdjustmentSelection,
  GradeAdjustment,
} from "@/types/api";

/** 定義済みの任意加減点項目 */
const ADJUSTMENT_DEFINITIONS: AdjustmentDefinition[] = [
  { kind: "bonus", code: "helped", label: "お手伝いをした" },
  { kind: "bonus", code: "test100", label: "テストで100点を取れた" },
  { kind: "penalty", code: "lied", label: "嘘をついた" },
  { kind: "penalty", code: "defiant", label: "反抗的な態度を取った" },
];

const MINUTE_OPTIONS = [10, 20, 30, 40, 50, 60];

/**
 * 初期の調整選択状態を構築する
 * @param {GradeAdjustment[]} existing - 既存の調整
 * @returns {Record<AdjustmentCode, AdjustmentSelection>} 選択状態
 */
function buildAdjustmentState(
  existing: GradeAdjustment[],
): Record<AdjustmentCode, AdjustmentSelection> {
  const state: Record<AdjustmentCode, AdjustmentSelection> = {
    helped: { enabled: false, minutes: 10 },
    test100: { enabled: false, minutes: 10 },
    lied: { enabled: false, minutes: 10 },
    defiant: { enabled: false, minutes: 10 },
  };
  for (const adj of existing) {
    state[adj.code] = { enabled: true, minutes: adj.minutes };
  }
  return state;
}

/**
 * 採点画面
 * @returns {JSX.Element} ページ
 */
export function GradeDatePage() {
  const { date = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: gradeData, isLoading } = useQuery(gradeQuery(date));
  const { data: daily } = useDailyQuests();
  const [grades, setGrades] = useState<Record<string, boolean>>({});
  const [adjustments, setAdjustments] = useState<
    Record<AdjustmentCode, AdjustmentSelection>
  >({
    helped: { enabled: false, minutes: 10 },
    test100: { enabled: false, minutes: 10 },
    lied: { enabled: false, minutes: 10 },
    defiant: { enabled: false, minutes: 10 },
  });

  useEffect(() => {
    if (!gradeData) return;
    setGrades((prev) => {
      const next = { ...prev };
      for (const item of gradeData.items) {
        if (isUnknownChildAnswer(item.childAnswer)) continue;
        if (item.actualDone !== null && next[item.questId] === undefined) {
          next[item.questId] = item.actualDone;
        }
      }
      return next;
    });
    setAdjustments(buildAdjustmentState(gradeData.adjustments ?? []));
  }, [gradeData]);

  const gradableItems = useMemo(
    () => gradeData?.items.filter((item) => !isUnknownChildAnswer(item.childAnswer)) ?? [],
    [gradeData],
  );

  const isComplete =
    gradableItems.length === 0 ||
    gradableItems.every((item) => grades[item.questId] !== undefined);

  const mutation = useMutation({
    mutationFn: () => {
      if (!gradeData) throw new Error("GradeDatePage: データがありません");
      const payload = gradableItems.map((item) => {
        const actualDone = grades[item.questId];
        if (actualDone === undefined) {
          throw new Error(`GradeDatePage: 未採点 questId=${item.questId}`);
        }
        return { questId: item.questId, actualDone };
      });
      const adjustmentPayload: GradeAdjustment[] = ADJUSTMENT_DEFINITIONS.filter(
        (def) => adjustments[def.code].enabled,
      ).map((def) => ({
        kind: def.kind,
        code: def.code,
        minutes: adjustments[def.code].minutes,
      }));
      return postGrade({
        date,
        grades: payload,
        adjustments: adjustmentPayload.length > 0 ? adjustmentPayload : undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gradeDates });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      navigate("/grade");
    },
  });

  if (isLoading || !gradeData) {
    return <LoadingScreen />;
  }

  return (
    <AppLayout>
      <h1 className="mb-2 text-app-lg font-bold">
        採点 {formatDateJa(date)}
      </h1>
      <p className="mb-4 text-sm text-muted">
        実際にできた / できなかった を選んでください。
        「分からない」と答えたものは採点不要です（虚偽の次に重い減点が自動でつきます）。
      </p>

      <ul className="flex flex-col gap-4">
        {gradeData.items.map((item) => {
          const title =
            daily?.quests.find((q) => q.id === item.questId)?.title ?? item.questId;
          const isUnknown = isUnknownChildAnswer(item.childAnswer);
          const selected = grades[item.questId];
          return (
            <li key={item.questId} className="rounded-default bg-white p-4 shadow-sm">
              <p className="font-medium">{title}</p>
              <p className="mb-3 text-sm text-muted">
                子どもの回答: {childAnswerLabel(item.childAnswer)}
              </p>
              {isUnknown ? (
                <p className="text-sm text-warning">
                  採点不要（自動で減点）
                </p>
              ) : (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    variant={selected === true ? "primary" : "secondary"}
                    onClick={() =>
                      setGrades((g) => ({ ...g, [item.questId]: true }))
                    }
                  >
                    実際にできた
                  </Button>
                  <Button
                    className="flex-1"
                    variant={selected === false ? "primary" : "secondary"}
                    onClick={() =>
                      setGrades((g) => ({ ...g, [item.questId]: false }))
                    }
                  >
                    実際にできなかった
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <section className="mt-6 rounded-default bg-white p-4 shadow-sm">
        <h2 className="mb-3 font-medium">任意のボーナス・ペナルティ（任意）</h2>
        <ul className="flex flex-col gap-3">
          {ADJUSTMENT_DEFINITIONS.map((def) => {
            const sel = adjustments[def.code];
            return (
              <li key={def.code} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={sel.enabled}
                    onChange={(e) =>
                      setAdjustments((prev) => ({
                        ...prev,
                        [def.code]: { ...prev[def.code], enabled: e.target.checked },
                      }))
                    }
                  />
                  <span>
                    {def.kind === "bonus" ? "ボーナス" : "ペナルティ"}: {def.label}
                  </span>
                </label>
                {sel.enabled && (
                  <select
                    className="rounded-default border border-gray-300 px-3 py-2"
                    value={sel.minutes}
                    onChange={(e) =>
                      setAdjustments((prev) => ({
                        ...prev,
                        [def.code]: {
                          ...prev[def.code],
                          minutes: Number(e.target.value),
                        },
                      }))
                    }
                  >
                    {MINUTE_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {def.kind === "bonus" ? "+" : "-"}
                        {m}分
                      </option>
                    ))}
                  </select>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {mutation.error && (
        <p className="mt-4 text-danger">
          {mutation.error instanceof Error ? mutation.error.message : "エラー"}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        <Button
          fullWidth
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !isComplete}
        >
          採点を確定
        </Button>
        <Button variant="secondary" fullWidth onClick={() => navigate("/grade")}>
          一覧に戻る
        </Button>
      </div>
    </AppLayout>
  );
}
