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
import { useGradeAdjustmentDefinitions } from "@/hooks/useGradeAdjustmentDefinitions";
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { formatDateJa } from "@/lib/date";
import { childAnswerLabel, isUnknownChildAnswer } from "@/lib/labels";
import { resolveQuestTitle } from "@/lib/questLabels";
import type { AdjustmentDefinition, GradeAdjustment } from "@/types/api";

const BONUS_MINUTE_OPTIONS = [10, 20, 30, 40, 50, 60];
const PENALTY_MINUTE_OPTIONS = [-10, -20, -30, -40, -50, -60];

interface AdjustmentRow {
  id: string;
  code: string;
  minutes: number;
}

/**
 * 既存の加減点から選択行を構築する
 * @param {GradeAdjustment[]} existing - 既存の調整
 * @param {AdjustmentDefinition[]} definitions - 現在の定義一覧
 * @returns {AdjustmentRow[]} 選択行
 */
function buildAdjustmentRows(
  existing: GradeAdjustment[],
  definitions: AdjustmentDefinition[],
): AdjustmentRow[] {
  const validCodes = new Set(definitions.map((def) => def.code));
  return existing
    .filter((adj) => validCodes.has(adj.code))
    .map((adj, index) => ({
      id: `${adj.kind}-${adj.code}-${index}`,
      code: adj.code,
      minutes: adj.kind === "bonus" ? adj.minutes : -adj.minutes,
    }));
}

/**
 * 定義から削除された既存 code を返す
 * @param {GradeAdjustment[]} existing - 既存の調整
 * @param {AdjustmentDefinition[]} definitions - 現在の定義一覧
 * @returns {string[]} 未知の code 一覧
 */
function findUnknownAdjustmentCodes(
  existing: GradeAdjustment[],
  definitions: AdjustmentDefinition[],
): string[] {
  const validCodes = new Set(definitions.map((def) => def.code));
  return [...new Set(existing.map((adj) => adj.code).filter((code) => !validCodes.has(code)))];
}

/**
 * 未選択の最初の定義を返す
 * @param {AdjustmentDefinition[]} definitions - 定義一覧
 * @param {AdjustmentRow[]} rows - 現在の選択行
 * @returns {AdjustmentDefinition | undefined} 未選択の定義
 */
function firstAvailableDefinition(
  definitions: AdjustmentDefinition[],
  rows: AdjustmentRow[],
): AdjustmentDefinition | undefined {
  const selected = new Set(rows.map((row) => row.code));
  return definitions.find((def) => !selected.has(def.code));
}

/**
 * 分数の表示ラベルを返す
 * @param {number} minutes - 分数
 * @returns {string} 表示ラベル
 */
function formatMinuteOption(minutes: number): string {
  return `${minutes > 0 ? "+" : ""}${minutes}分`;
}

/**
 * 定義に応じた初期分数を返す
 * @param {AdjustmentDefinition} def - 加減点定義
 * @returns {number} 初期分数
 */
function defaultMinutesFor(def: AdjustmentDefinition): number {
  return def.kind === "bonus" ? 10 : -10;
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
  const {
    data: adjustmentDefinitions,
    isLoading: isAdjustmentDefinitionsLoading,
    isError: isAdjustmentDefinitionsError,
    error: adjustmentDefinitionsError,
  } = useGradeAdjustmentDefinitions();
  const [grades, setGrades] = useState<Record<string, boolean>>({});
  const [usesAdjustments, setUsesAdjustments] = useState(false);
  const [adjustmentRows, setAdjustmentRows] = useState<AdjustmentRow[]>([]);
  const [unknownAdjustmentCodes, setUnknownAdjustmentCodes] = useState<string[]>([]);

  const adjustmentItems = adjustmentDefinitions?.items ?? [];

  useEffect(() => {
    if (!gradeData || !adjustmentDefinitions) return;
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
    const rows = buildAdjustmentRows(gradeData.adjustments ?? [], adjustmentDefinitions.items);
    setUnknownAdjustmentCodes(
      findUnknownAdjustmentCodes(gradeData.adjustments ?? [], adjustmentDefinitions.items),
    );
    setAdjustmentRows(rows);
    setUsesAdjustments(rows.length > 0);
  }, [gradeData, adjustmentDefinitions]);

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
      const definitionMap = new Map(adjustmentItems.map((def) => [def.code, def]));
      const adjustmentPayload: GradeAdjustment[] = usesAdjustments
        ? adjustmentRows.map((row) => {
            const def = definitionMap.get(row.code);
            if (!def) {
              throw new Error(`GradeDatePage: 未知の調整項目 code=${row.code}`);
            }
            return {
              kind: def.kind,
              code: row.code,
              minutes: Math.abs(row.minutes),
            };
          })
        : [];
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

  function handleUsesAdjustmentsChange(next: boolean) {
    setUsesAdjustments(next);
    if (next && adjustmentRows.length === 0) {
      const first = firstAvailableDefinition(adjustmentItems, []);
      if (first) {
        setAdjustmentRows([
          {
            id: `${first.code}-${Date.now()}`,
            code: first.code,
            minutes: defaultMinutesFor(first),
          },
        ]);
      }
    }
  }

  function handleAddAdjustmentRow() {
    const next = firstAvailableDefinition(adjustmentItems, adjustmentRows);
    if (!next) return;
    setAdjustmentRows((rows) => [
      ...rows,
      {
        id: `${next.code}-${Date.now()}`,
        code: next.code,
        minutes: defaultMinutesFor(next),
      },
    ]);
  }

  function updateAdjustmentRow(id: string, patch: Partial<Omit<AdjustmentRow, "id">>) {
    setAdjustmentRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  function removeAdjustmentRow(id: string) {
    setAdjustmentRows((rows) => rows.filter((row) => row.id !== id));
  }

  const canAddAdjustment =
    usesAdjustments && adjustmentRows.length < adjustmentItems.length;

  if (isAdjustmentDefinitionsError) {
    return (
      <AppLayout>
        <p className="text-danger">
          {adjustmentDefinitionsError instanceof Error
            ? adjustmentDefinitionsError.message
            : "任意加減点の定義を読み込めませんでした。"}
        </p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate("/grade")}>
          一覧に戻る
        </Button>
      </AppLayout>
    );
  }

  if (isLoading || isAdjustmentDefinitionsLoading || !gradeData) {
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
          const title = resolveQuestTitle(daily, item.questId);
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
        <h2 className="mb-3 font-medium">
          ボーナスまたはペナルティタイムを追加しますか？
        </h2>
        <div className="mb-4 flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="uses-adjustments"
              checked={usesAdjustments}
              onChange={() => handleUsesAdjustmentsChange(true)}
            />
            <span>はい</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="uses-adjustments"
              checked={!usesAdjustments}
              onChange={() => handleUsesAdjustmentsChange(false)}
            />
            <span>いいえ</span>
          </label>
        </div>

        {usesAdjustments && (
          <div className="flex flex-col gap-3">
            {unknownAdjustmentCodes.length > 0 && (
              <p className="rounded-default bg-warning/20 px-3 py-2 text-sm text-gray-900">
                定義から削除された加減点項目は編集対象から外しています:{" "}
                {unknownAdjustmentCodes.join(", ")}
              </p>
            )}
            {adjustmentRows.map((row) => {
              const selectedCodes = new Set(
                adjustmentRows.filter((r) => r.id !== row.id).map((r) => r.code),
              );
              const currentDef = adjustmentItems.find((def) => def.code === row.code);
              const minuteOptions =
                currentDef?.kind === "penalty"
                  ? PENALTY_MINUTE_OPTIONS
                  : BONUS_MINUTE_OPTIONS;
              return (
                <div
                  key={row.id}
                  className="flex flex-col gap-2 rounded-default border border-gray-200 p-3"
                >
                  <select
                    className="rounded-default border border-gray-300 px-3 py-2"
                    value={row.code}
                    onChange={(e) => {
                      const nextDef = adjustmentItems.find(
                        (def) => def.code === e.target.value,
                      );
                      updateAdjustmentRow(row.id, {
                        code: e.target.value,
                        minutes: nextDef ? defaultMinutesFor(nextDef) : row.minutes,
                      });
                    }}
                  >
                    {adjustmentItems.map((def) => (
                      <option
                        key={def.code}
                        value={def.code}
                        disabled={selectedCodes.has(def.code)}
                      >
                        {def.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <select
                      className="min-w-0 flex-1 rounded-default border border-gray-300 px-3 py-2"
                      value={row.minutes}
                      onChange={(e) =>
                        updateAdjustmentRow(row.id, { minutes: Number(e.target.value) })
                      }
                    >
                      {minuteOptions.map((m) => (
                        <option key={m} value={m}>
                          {formatMinuteOption(m)}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      className="px-4 text-base"
                      onClick={() => removeAdjustmentRow(row.id)}
                    >
                      削除
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button
              variant="secondary"
              fullWidth
              onClick={handleAddAdjustmentRow}
              disabled={!canAddAdjustment}
            >
              さらに追加
            </Button>
          </div>
        )}
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
