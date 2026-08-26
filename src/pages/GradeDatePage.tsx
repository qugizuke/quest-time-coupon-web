/**
 * @file GradeDatePage
 * @description 保護者採点詳細（⭕️❌・採点拒否ダイアログ・任意加減点）。
 *   レイアウト: 日付→登録時刻→拒否上部→設問→加減点→確定下部。
 *   登録時刻は GET grade.submittedAt（ISO）を JST 表示する。欠落時は —。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { postGrade, postGradeReject } from "@/api/client";
import { gradeQuery, queryKeys } from "@/api/queries";
import { ParentPageFrame } from "@/components/layout/ParentPageFrame";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/StatusBadge";
import { useGradeAdjustmentDefinitions } from "@/hooks/useGradeAdjustmentDefinitions";
import { useDailyQuests } from "@/hooks/useDailyQuests";
import { formatDateJa, formatJstClockJa } from "@/lib/date";
import {
  isNegativeChildAnswer,
  isParentGradableAnswer,
  resolveActualDoneForSubmit,
} from "@/lib/gradeUi";
import { childAnswerLabel, isUnknownChildAnswer } from "@/lib/labels";
import { isSkipAnswerQuest, resolveQuestTitle } from "@/lib/questLabels";
import type { AdjustmentDefinition, DailyQuests, GradeAdjustment } from "@/types/api";

/** 任意加減点の選択肢（ADR-005: 10pt刻み・上限100pt） */
const BONUS_POINT_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const PENALTY_POINT_OPTIONS = [-10, -20, -30, -40, -50, -60, -70, -80, -90, -100];

/** 採点拒否ダイアログ本文（仕様正・一字一句） */
const REJECT_DIALOG_BODY =
  "今日のクエストは採点せず、-100ptにします。\nこの操作は取り消せません。";

interface AdjustmentRow {
  id: string;
  code: string;
  points: number;
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
      points: adj.kind === "bonus" ? adj.points : -adj.points,
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
 * ポイントの表示ラベルを返す
 * @param {number} points - ポイント
 * @returns {string} 表示ラベル
 */
function formatPointOption(points: number): string {
  return `${points > 0 ? "+" : ""}${points}pt`;
}

/**
 * 定義に応じた初期ポイントを返す
 * @param {AdjustmentDefinition} def - 加減点定義
 * @returns {number} 初期ポイント
 */
function defaultPointsFor(def: AdjustmentDefinition): number {
  return def.kind === "bonus" ? 10 : -10;
}

/**
 * 定時登録ボーナス判定用クエストか
 * @param {DailyQuests | undefined} daily - クエスト定義
 * @param {string} questId - クエスト ID
 * @returns {boolean} 判定用なら true
 */
function isRegistrationGateQuest(
  daily: DailyQuests | undefined,
  questId: string,
): boolean {
  return daily?.quests.find((q) => q.id === questId)?.scoringRole === "registrationGate";
}

/**
 * 条件付き宿題追問か
 * @param {DailyQuests | undefined} daily - クエスト定義
 * @param {string} questId - クエスト ID
 * @returns {boolean} 条件付きなら true
 */
function isConditionalQuest(
  daily: DailyQuests | undefined,
  questId: string,
): boolean {
  return daily?.quests.find((q) => q.id === questId)?.scoringRole === "conditional";
}

/**
 * 採点状態の表示を返す
 * @param {GradeData} gradeData - 採点データ
 * @returns {{ label: string; tone: StatusBadgeTone }} 表示内容
 */
function gradeStatus(gradeData: {
  isGraded: boolean;
  isRejected: boolean;
}): { label: string; tone: StatusBadgeTone } {
  if (gradeData.isRejected) return { label: "採点拒否済み", tone: "danger" };
  if (gradeData.isGraded) return { label: "採点済み", tone: "success" };
  return { label: "採点待ち", tone: "danger" };
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
  const { data: daily } = useDailyQuests(date);
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
  const [rejectOpen, setRejectOpen] = useState(false);

  const adjustmentItems = adjustmentDefinitions?.items ?? [];
  const readOnly = Boolean(gradeData?.isGraded || gradeData?.isExempt);

  useEffect(() => {
    if (!gradeData || !adjustmentDefinitions) return;
    setGrades((prev) => {
      const next = { ...prev };
      for (const item of gradeData.items) {
        if (!isParentGradableAnswer(item.childAnswer)) continue;
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
    () => gradeData?.items.filter((item) => isParentGradableAnswer(item.childAnswer)) ?? [],
    [gradeData],
  );

  const isComplete =
    gradableItems.length === 0 ||
    gradableItems.every((item) => grades[item.questId] !== undefined);

  const gradedCount = gradableItems.filter(
    (item) => grades[item.questId] !== undefined,
  ).length;
  const totalItemCount = gradableItems.length;
  const progressPercent =
    totalItemCount === 0 ? 0 : Math.round((gradedCount / totalItemCount) * 100);

  const mutation = useMutation({
    mutationFn: () => {
      if (!gradeData) throw new Error("GradeDatePage: データがありません");
      const payload = gradeData.items.flatMap((item) => {
        try {
          const actualDone = resolveActualDoneForSubmit(
            item.childAnswer,
            grades[item.questId],
          );
          if (actualDone === undefined) return [];
          return [{ questId: item.questId, actualDone }];
        } catch (error) {
          throw new Error(
            `GradeDatePage: 未採点 questId=${item.questId} ` +
              `(${error instanceof Error ? error.message : String(error)})`,
          );
        }
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
              points: Math.abs(row.points),
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
      navigate("/parent/grades");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => postGradeReject(date),
    onSuccess: () => {
      setRejectOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.gradeDates });
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({ queryKey: queryKeys.results });
      navigate("/parent/grades");
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
            points: defaultPointsFor(first),
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
        points: defaultPointsFor(next),
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
      <ParentPageFrame>
        <p className="text-danger">
          {adjustmentDefinitionsError instanceof Error
            ? adjustmentDefinitionsError.message
            : "任意加減点の定義を読み込めませんでした。"}
        </p>
        <Button className="mt-4" variant="secondary" onClick={() => navigate("/parent/grades")}>
          一覧に戻る
        </Button>
      </ParentPageFrame>
    );
  }

  if (isLoading || isAdjustmentDefinitionsLoading || !gradeData) {
    return <LoadingScreen />;
  }

  if (gradeData.isExempt) {
    return (
      <ParentPageFrame>
        <h1 className="mb-2 text-app-lg font-bold">採点 {formatDateJa(date)}</h1>
        <p className="mb-4 text-muted">免除日のため採点対象外です。</p>
        <Button variant="secondary" fullWidth onClick={() => navigate("/parent/grades")}>
          一覧に戻る
        </Button>
      </ParentPageFrame>
    );
  }

  const clock = formatJstClockJa(gradeData.submittedAt);
  const status = gradeStatus(gradeData);

  return (
    <ParentPageFrame>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-app-lg font-bold">📝 採点 {formatDateJa(date)}</h1>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </header>
      <p className="mb-4 text-sm text-ink">
        今日は {clock} に登録されました。
      </p>
      {gradeData.isRejected && (
        <p className="mb-4 rounded-default bg-danger-soft px-3 py-2 text-sm text-danger">
          この日は採点拒否（-100pt）済みです。
        </p>
      )}

      <section
        className="mb-6 rounded-default border-[3px] border-border bg-surface p-4 shadow-[var(--shadow-card)]"
        aria-labelledby="grading-progress-title"
      >
        <div className="mb-2 flex items-center justify-between gap-3 text-sm">
          <h2 id="grading-progress-title" className="font-semibold text-ink">
            採点進捗
          </h2>
          <span className="text-muted">
            {gradedCount}/{totalItemCount} 採点済み
          </span>
        </div>
        <div
          className="h-3 overflow-hidden rounded-pill border border-border bg-surface-soft"
          role="progressbar"
          aria-label="採点進捗"
          aria-valuemin={0}
          aria-valuemax={totalItemCount}
          aria-valuenow={gradedCount}
        >
          <div
            className="h-full rounded-pill bg-primary transition-[width]"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </section>

      <h2 className="mb-3 font-semibold text-ink">📋 クエスト回答状況</h2>

      <ul className="flex flex-col gap-4">
        {gradeData.items.map((item, index) => {
          const title = resolveQuestTitle(daily, item.questId, {
            preferFollowUpTitle: true,
          });
          const isUnknown = isUnknownChildAnswer(item.childAnswer);
          const isNegative = isNegativeChildAnswer(item.childAnswer);
          const isGradable = isParentGradableAnswer(item.childAnswer);
          const selected = grades[item.questId];
          const isRegistrationGate = isRegistrationGateQuest(daily, item.questId);
          const isConditional = isConditionalQuest(daily, item.questId);
          const appliesFalseClaimPenalty =
            isRegistrationGate && item.childAnswer === 1 && selected === false;
          const followUpTitle =
            daily?.quests.find((q) => q.id === item.questId)?.conditional?.followUpTitle ??
            title;

          return (
            <li
              key={item.questId}
              className="rounded-default border-[3px] border-border bg-surface p-4 shadow-[var(--shadow-card)]"
            >
              <p className="font-medium text-ink">
                <span className="mr-2 text-xs font-semibold text-muted">
                  Q{index + 1}
                </span>
                {title}
              </p>
              {isRegistrationGate && (
                <>
                  <p className="mt-2 text-sm text-ink">
                    今日は {clock} に登録されました。
                    クエスト登録までに寝る準備は終わっていましたか？
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {gradeData.withinBonusDeadline
                      ? "⭕️なら定時登録ボーナス +5ptの対象です。❌の場合、虚偽として -30ptになります。"
                      : "ボーナスタイム外の登録のため、定時ボーナスは付きません。❌の場合、虚偽として -30ptになります。"}
                  </p>
                </>
              )}
              {isConditional && isGradable && (
                <p className="mt-2 text-sm text-ink">
                  子どもは『{followUpTitle}』と答えました。実際はテキパキできていましたか？
                </p>
              )}
              <p
                className={`mb-3 mt-3 text-sm font-semibold ${
                  isUnknown
                    ? "text-warning"
                    : isNegative
                      ? "text-danger"
                      : "text-success"
                }`}
              >
                {isUnknown ? "🤔" : isNegative ? "👎" : "👍"}{" "}
                {childAnswerLabel(
                  item.childAnswer,
                  "default",
                  item.questId,
                  item.gradingMode,
                )}
              </p>
              {isUnknown || isNegative ? (
                <div className="rounded-default border border-border-soft bg-surface-warm px-3 py-4 text-sm text-muted">
                  ℹ️ 否定・わからない回答のため採点対象外
                  {isUnknown && isSkipAnswerQuest(item.questId, item.gradingMode) && (
                    <span className="sr-only">（点0・ストリーク非接触）</span>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">保護者の判定</span>
                  <button
                    type="button"
                    className={`rounded-default border-2 px-3 py-1 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected === true
                        ? "border-success bg-success-soft text-success"
                        : "border-success bg-surface text-success"
                    }`}
                    disabled={readOnly}
                    aria-label="できた（⭕️）"
                    aria-pressed={selected === true}
                    onClick={() =>
                      setGrades((g) => ({ ...g, [item.questId]: true }))
                    }
                  >
                    ⭕ 正しい
                  </button>
                  <button
                    type="button"
                    className={`rounded-default border-2 px-3 py-1 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected === false
                        ? "border-danger bg-danger-soft text-danger"
                        : "border-border bg-surface text-danger"
                    }`}
                    disabled={readOnly}
                    aria-label="できていない（❌）"
                    aria-pressed={selected === false}
                    onClick={() =>
                      setGrades((g) => ({ ...g, [item.questId]: false }))
                    }
                  >
                    ❌ 虚偽
                  </button>
                </div>
              )}
              {appliesFalseClaimPenalty && (
                <p className="mt-3 rounded-default bg-danger/10 px-3 py-2 text-sm text-danger">
                  虚偽ペナルティ -30pt が付きます。
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {!gradeData.isRejected && (
        <details
          className="mt-6 rounded-default border-[3px] border-border bg-surface p-4 shadow-[var(--shadow-card)]"
          open={usesAdjustments || undefined}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
            <span>
              ボーナス / ペナルティ
              <span className="ml-2 text-xs text-muted">折り畳み</span>
            </span>
            <span className="text-xs font-normal text-muted">
              {usesAdjustments
                ? `${adjustmentRows.length}件の加減点あり`
                : "加減点なし"}
            </span>
          </summary>
          <p className="mb-3 mt-4 text-sm text-ink">
            ボーナスまたはペナルティタイムを追加しますか？
          </p>
          <div className="mb-4 flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="uses-adjustments"
                checked={usesAdjustments}
                disabled={readOnly}
                onChange={() => handleUsesAdjustmentsChange(true)}
              />
              <span>はい</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="uses-adjustments"
                checked={!usesAdjustments}
                disabled={readOnly}
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
                const pointOptions =
                  currentDef?.kind === "penalty"
                    ? PENALTY_POINT_OPTIONS
                    : BONUS_POINT_OPTIONS;
                return (
                  <div
                    key={row.id}
                    className="flex flex-col gap-2 rounded-default border border-border-soft p-3"
                  >
                    <select
                      className="rounded-default border border-border-soft px-3 py-2"
                      value={row.code}
                      disabled={readOnly}
                      onChange={(e) => {
                        const nextDef = adjustmentItems.find(
                          (def) => def.code === e.target.value,
                        );
                        updateAdjustmentRow(row.id, {
                          code: e.target.value,
                          points: nextDef ? defaultPointsFor(nextDef) : row.points,
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
                        className="min-w-0 flex-1 rounded-default border border-border-soft px-3 py-2"
                        value={row.points}
                        disabled={readOnly}
                        onChange={(e) =>
                          updateAdjustmentRow(row.id, { points: Number(e.target.value) })
                        }
                      >
                        {pointOptions.map((p) => (
                          <option key={p} value={p}>
                            {formatPointOption(p)}
                          </option>
                        ))}
                      </select>
                      {!readOnly && (
                        <Button
                          variant="secondary"
                          className="px-4 text-base"
                          onClick={() => removeAdjustmentRow(row.id)}
                        >
                          削除
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {!readOnly && (
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={handleAddAdjustmentRow}
                  disabled={!canAddAdjustment}
                >
                  さらに追加
                </Button>
              )}
            </div>
          )}
        </details>
      )}

      {mutation.error && (
        <p className="mt-4 text-danger">
          {mutation.error instanceof Error ? mutation.error.message : "エラー"}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {!readOnly && (
          <Button
            fullWidth
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !isComplete}
          >
            採点を確定
          </Button>
        )}
        <Button variant="secondary" fullWidth onClick={() => navigate("/parent/grades")}>
          一覧に戻る
        </Button>
      </div>

      {!readOnly && (
        <section className="mt-8 border-t border-border-soft pt-4">
          <p className="mb-3 text-xs text-muted">採点拒否する場合</p>
          <Button variant="danger" fullWidth onClick={() => setRejectOpen(true)}>
            採点を拒否する
          </Button>
        </section>
      )}

      {rejectOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-overlay backdrop-blur-sm"
            aria-label="ダイアログを閉じる"
            onClick={() => setRejectOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="grade-reject-title"
            className="relative z-10 w-full max-w-lg rounded-card border-4 border-border-soft bg-surface p-4 shadow-[var(--shadow-card)]"
          >
            <h2 id="grade-reject-title" className="mb-3 text-app-lg font-bold text-ink">
              採点拒否
            </h2>
            <p className="mb-4 whitespace-pre-line text-ink">{REJECT_DIALOG_BODY}</p>
            {rejectMutation.error && (
              <p className="mb-3 text-sm text-danger">
                {rejectMutation.error instanceof Error
                  ? rejectMutation.error.message
                  : "拒否に失敗しました"}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="secondary"
                onClick={() => setRejectOpen(false)}
              >
                キャンセル
              </Button>
              <Button
                className="flex-1"
                variant="danger"
                disabled={rejectMutation.isPending}
                onClick={() => rejectMutation.mutate()}
              >
                -100ptにする
              </Button>
            </div>
          </div>
        </div>
      )}
    </ParentPageFrame>
  );
}
