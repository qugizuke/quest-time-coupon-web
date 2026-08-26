/**
 * @file ParentSettingsPage
 * @description 保護者設定（長期休み・免除期間・当日就寝 21/22/23）。
 *   長期休み・免除は longVacation / questExemptions API（id なし・期間キー）。
 *   就寝編集可否は parentHome.canEditBedtimeAsParent を正とする。
 *   Figma v6 parent-settings のサマリ＋3カード1カラムに寄せる（Issue #79）。
 *   Figma 差分は仕様勝ち: 就寝に 22:30 なし、D12 ボーナス増加文言なし。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  postLongVacation,
  postQuestExemptions,
  postRegistrationSetting,
} from "@/api/client";
import {
  longVacationQuery,
  parentHomeQuery,
  queryKeys,
  questExemptionsQuery,
} from "@/api/queries";
import { ParentPageFrame } from "@/components/layout/ParentPageFrame";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatWeekdayJa, parseDateString, todayLocal } from "@/lib/date";
import {
  evaluateParentBedtimeChange,
  getParentSelectableBedtimeHours,
  PARENT_BEDTIME_HOUR_OPTIONS,
} from "@/lib/homeMode";
import type { BedtimeHour, ExemptionPeriod } from "@/types/api";

/** 長期休み説明（D12 仕様勝ち） */
const VACATION_HELP =
  "長期休み期間中は、就寝・起床のルールが毎日適用されます。基本ボーナス時間は増加しません。";

/**
 * 免除期間のキー（契約: id なし・startDate+endDate）
 * @param {Pick<ExemptionPeriod, "startDate" | "endDate">} period - 期間
 * @returns {string} キー
 */
function exemptionKey(
  period: Pick<ExemptionPeriod, "startDate" | "endDate">,
): string {
  return `${period.startDate}|${period.endDate}`;
}

/**
 * 画面表示用のスラッシュ日付＋曜日（例: 2026/10/17（土））
 * @param {string} value - YYYY-MM-DD
 * @returns {string} 表示ラベル
 */
function formatSlashDateWithWeekday(value: string): string {
  return `${value.replaceAll("-", "/")}（${formatWeekdayJa(value)}）`;
}

/**
 * 免除期間の日数（両端含む）
 * @param {Pick<ExemptionPeriod, "startDate" | "endDate">} period - 期間
 * @returns {number} 日数（パース失敗時 0）
 */
function exemptionDayCount(
  period: Pick<ExemptionPeriod, "startDate" | "endDate">,
): number {
  const start = parseDateString(period.startDate);
  const end = parseDateString(period.endDate);
  if (!start || !end) {
    return 0;
  }
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

/**
 * 保護者設定
 * @returns {JSX.Element} ページ
 */
export function ParentSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = todayLocal();

  const {
    data: parentHome,
    isLoading: parentHomeLoading,
    error: parentHomeError,
  } = useQuery(parentHomeQuery);
  const {
    data: longVacation,
    isLoading: vacationLoading,
    error: vacationError,
  } = useQuery(longVacationQuery);
  const {
    data: exemptions,
    isLoading: exemptionsLoading,
    error: exemptionsError,
  } = useQuery(questExemptionsQuery);

  const [vacationDraft, setVacationDraft] = useState({
    startDate: today,
    endDate: today,
  });
  const [exemptStart, setExemptStart] = useState(today);
  const [exemptEnd, setExemptEnd] = useState(today);
  const [editingExemptKey, setEditingExemptKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [bedtimeHour, setBedtimeHour] = useState<BedtimeHour>(21);

  useEffect(() => {
    if (
      longVacation?.startDate &&
      longVacation?.endDate
    ) {
      setVacationDraft({
        startDate: longVacation.startDate,
        endDate: longVacation.endDate,
      });
    }
  }, [longVacation?.startDate, longVacation?.endDate]);

  useEffect(() => {
    if (
      parentHome?.bedtimeHour === 21 ||
      parentHome?.bedtimeHour === 22 ||
      parentHome?.bedtimeHour === 23
    ) {
      setBedtimeHour(parentHome.bedtimeHour);
    }
  }, [parentHome?.bedtimeHour]);

  /** 保護者が今選べる就寝候補（変更先ごとの 1 時間前期限で絞る） */
  const selectableBedtimeHours = useMemo(() => {
    if (!parentHome?.canEditBedtimeAsParent) {
      return [];
    }
    return getParentSelectableBedtimeHours(today);
  }, [parentHome?.canEditBedtimeAsParent, today]);

  useEffect(() => {
    if (selectableBedtimeHours.length === 0) {
      return;
    }
    if (selectableBedtimeHours.includes(bedtimeHour)) {
      return;
    }
    const preferred = parentHome?.bedtimeHour;
    if (
      preferred === 21 ||
      preferred === 22 ||
      preferred === 23
    ) {
      if (selectableBedtimeHours.includes(preferred)) {
        setBedtimeHour(preferred);
        return;
      }
    }
    setBedtimeHour(selectableBedtimeHours[0]);
  }, [selectableBedtimeHours, bedtimeHour, parentHome?.bedtimeHour]);

  const vacationConfigured = Boolean(
    longVacation?.startDate && longVacation?.endDate,
  );
  const exemptList = exemptions?.periods ?? [];

  /**
   * サーバの canEditBedtimeAsParent を正とし、ブロック文言のみローカル補助
   */
  const bedtimeChange = useMemo(() => {
    if (!parentHome) {
      return {
        allowed: false,
        message: "読み込み中です",
      };
    }
    if (parentHome.canEditBedtimeAsParent) {
      if (selectableBedtimeHours.length === 0) {
        return {
          allowed: false,
          message: "就寝1時間前を過ぎているため変更できません",
        };
      }
      return { allowed: true, message: "" };
    }
    const status = parentHome.todayRegistrationStatus;
    const hasAnswers =
      status === "registered" ||
      status === "graded" ||
      status === "result_pending_ack";
    const hasResult =
      status === "graded" || status === "result_pending_ack";
    // 対象日フラグは parentHome に無いため、長期休み or 許可されていたら対象日扱いで文言を取る
    const local = evaluateParentBedtimeChange({
      date: today,
      today,
      isExemptDay: parentHome.isExemptToday,
      isVacationMode: parentHome.isLongVacation,
      isWeekendEveDay: !parentHome.isLongVacation,
      hasAnswers,
      hasResult,
      bedtimeHour: parentHome.bedtimeHour,
      isTransitionPeriod: parentHome.isVacationTransition,
    });
    if (
      local.reason === "not_target_day" ||
      (!parentHome.isExemptToday &&
        !parentHome.isLongVacation &&
        !hasAnswers &&
        !hasResult &&
        local.reason !== "past_parent_deadline")
    ) {
      return {
        allowed: false,
        message: "休日前日または長期休みモード中のみ就寝時刻を変更できます",
      };
    }
    return {
      allowed: false,
      message: local.message || "現在は就寝時刻を変更できません",
    };
  }, [parentHome, today, selectableBedtimeHours]);

  const invalidateParentSettings = (): void => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.parentHome });
    void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    void queryClient.invalidateQueries({ queryKey: queryKeys.longVacation });
    void queryClient.invalidateQueries({ queryKey: queryKeys.questExemptions });
    void queryClient.invalidateQueries({ queryKey: queryKeys.gradeDates });
    void queryClient.invalidateQueries({ queryKey: queryKeys.results });
  };

  const bedtimeMutation = useMutation({
    mutationFn: (hour: BedtimeHour) =>
      postRegistrationSetting({
        date: today,
        bedtimeHour: hour,
        actor: "parent",
      }),
    onSuccess: (saved) => {
      setBedtimeHour(saved.bedtimeHour as BedtimeHour);
      setMessage("就寝時刻を保存しました");
      invalidateParentSettings();
    },
    onError: (err) => {
      setMessage(err instanceof Error ? err.message : "就寝の保存に失敗しました");
    },
  });

  const vacationMutation = useMutation({
    mutationFn: (payload: { startDate: string; endDate: string }) =>
      postLongVacation(payload),
    onSuccess: () => {
      setMessage("長期休みモードを保存しました");
      invalidateParentSettings();
    },
    onError: (err) => {
      setMessage(
        err instanceof Error ? err.message : "長期休みの保存に失敗しました",
      );
    },
  });

  const endVacationMutation = useMutation({
    mutationFn: () => postLongVacation({ startDate: "", endDate: "" }),
    onSuccess: () => {
      setMessage("長期休みモードを終了しました");
      invalidateParentSettings();
    },
    onError: (err) => {
      setMessage(
        err instanceof Error ? err.message : "長期休みの終了に失敗しました",
      );
    },
  });

  const addExemptMutation = useMutation({
    mutationFn: () =>
      postQuestExemptions({
        op: "add",
        startDate: exemptStart,
        endDate: exemptEnd,
      }),
    onSuccess: () => {
      setMessage("免除期間を追加しました");
      invalidateParentSettings();
    },
    onError: (err) => {
      setMessage(err instanceof Error ? err.message : "免除の追加に失敗しました");
    },
  });

  const removeExemptMutation = useMutation({
    mutationFn: (period: Pick<ExemptionPeriod, "startDate" | "endDate">) =>
      postQuestExemptions({
        op: "remove",
        startDate: period.startDate,
        endDate: period.endDate,
      }),
    onSuccess: () => {
      setMessage("免除期間を削除しました");
      invalidateParentSettings();
    },
    onError: (err) => {
      setMessage(err instanceof Error ? err.message : "免除の削除に失敗しました");
    },
  });

  const updateExemptMutation = useMutation({
    mutationFn: (payload: {
      startDate: string;
      endDate: string;
      newEndDate: string;
    }) =>
      postQuestExemptions({
        op: "updateEnd",
        startDate: payload.startDate,
        endDate: payload.endDate,
        newEndDate: payload.newEndDate,
      }),
    onSuccess: () => {
      setMessage("免除期間を更新しました");
      invalidateParentSettings();
    },
    onError: (err) => {
      setMessage(err instanceof Error ? err.message : "免除の更新に失敗しました");
    },
  });

  const isLoading =
    parentHomeLoading || vacationLoading || exemptionsLoading;
  const error = parentHomeError ?? vacationError ?? exemptionsError;

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <ParentPageFrame>
        <p className="text-danger">
          {error instanceof Error ? error.message : "読み込みに失敗しました"}
        </p>
      </ParentPageFrame>
    );
  }

  return (
    <ParentPageFrame>
      <div className="mx-auto flex w-full max-w-[800px] flex-col gap-6 pb-4 sm:gap-8">
        <h1 className="text-center text-[26px] font-bold text-ink">設定</h1>

        {message && (
          <p className="rounded-default bg-info-soft px-3 py-2 text-sm text-info">
            {message}
          </p>
        )}

        <Card className="flex flex-col gap-4" data-testid="settings-summary-card">
          <h2 className="text-2xl font-bold text-ink">現在の設定状況</h2>
          <dl className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink">🏖️ 長期休みモード</dt>
              <dd>
                <StatusBadge tone={vacationConfigured ? "success" : "muted"}>
                  {vacationConfigured ? "設定あり" : "未設定"}
                </StatusBadge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink">🎉 クエスト免除</dt>
              <dd>
                <StatusBadge tone={exemptList.length > 0 ? "success" : "muted"}>
                  {exemptList.length}件
                </StatusBadge>
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-ink">⏰ 当日の就寝時刻</dt>
              <dd>
                <StatusBadge tone="muted">
                  {parentHome?.bedtimeHour ?? 21}:00
                </StatusBadge>
              </dd>
            </div>
          </dl>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4" data-testid="long-vacation-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-ink">🏖️ 長期休みモード</h2>
              <div className="flex items-center gap-2">
                {parentHome?.isVacationTransition && (
                  <StatusBadge tone="warning" data-testid="vacation-transition-badge">
                    移行期間中
                  </StatusBadge>
                )}
                <StatusBadge tone={vacationConfigured ? "success" : "muted"}>
                  {vacationConfigured ? "設定あり" : "未設定"}
                </StatusBadge>
              </div>
            </div>
            <p className="text-sm text-muted">{VACATION_HELP}</p>
            {parentHome?.isVacationTransition && (
              <p className="text-sm text-info" data-testid="vacation-transition-help">
                終了1週間前の移行期間中です。就寝は21時固定、起床は7:00 / 7:30 / 8:00
                から選べます。
              </p>
            )}
            {vacationConfigured && (
              <p className="text-ink">
                現在の期間　{longVacation?.startDate.replaceAll("-", "/")} 〜{" "}
                {longVacation?.endDate.replaceAll("-", "/")}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1 text-xs text-ink">
                開始日
                <input
                  type="date"
                  className="min-h-touch rounded-default border border-border bg-surface px-3 py-2 text-base"
                  value={vacationDraft.startDate}
                  onChange={(e) =>
                    setVacationDraft((v) => ({ ...v, startDate: e.target.value }))
                  }
                />
              </label>
              <span className="hidden pb-4 text-muted sm:inline">〜</span>
              <label className="flex flex-1 flex-col gap-1 text-xs text-ink">
                終了日
                <input
                  type="date"
                  className="min-h-touch rounded-default border border-border bg-surface px-3 py-2 text-base"
                  value={vacationDraft.endDate}
                  onChange={(e) =>
                    setVacationDraft((v) => ({ ...v, endDate: e.target.value }))
                  }
                />
              </label>
            </div>
            <div className="flex flex-col justify-end gap-3 sm:flex-row">
              {vacationConfigured && (
                <Button
                  className="sm:w-[180px]"
                  variant="ghost"
                  disabled={endVacationMutation.isPending}
                  onClick={() => endVacationMutation.mutate()}
                >
                  終了
                </Button>
              )}
              <Button
                className="sm:w-[180px]"
                variant={vacationConfigured ? "secondary" : "primary"}
                disabled={vacationMutation.isPending}
                onClick={() =>
                  vacationMutation.mutate({
                    startDate: vacationDraft.startDate,
                    endDate: vacationDraft.endDate,
                  })
                }
              >
                {vacationConfigured ? "期間を変更" : "設定する"}
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col gap-4" data-testid="quest-exemptions-card">
            <h2 className="text-ink">🎉 クエスト免除</h2>
            <p className="text-sm text-muted">
              期間の追加・削除・終了日変更ができます（メモなし）。
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-1 flex-col gap-1 text-xs text-ink">
                開始日
                <input
                  type="date"
                  className="min-h-touch rounded-default border border-border bg-surface px-3 py-2 text-base"
                  value={exemptStart}
                  onChange={(e) => setExemptStart(e.target.value)}
                />
              </label>
              <span className="hidden pb-4 text-muted sm:inline">〜</span>
              <label className="flex flex-1 flex-col gap-1 text-xs text-ink">
                終了日
                <input
                  type="date"
                  className="min-h-touch rounded-default border border-border bg-surface px-3 py-2 text-base"
                  value={exemptEnd}
                  onChange={(e) => setExemptEnd(e.target.value)}
                />
              </label>
            </div>
            <Button
              fullWidth
              variant="secondary"
              disabled={addExemptMutation.isPending}
              onClick={() => addExemptMutation.mutate()}
            >
              期間を追加
            </Button>
            <div className="border-t border-border-soft pt-4">
              <h3 className="mb-3 text-ink">🗓️ 設定済みのお休み期間</h3>
              {exemptList.length === 0 ? (
                <p className="text-sm text-muted">免除期間はまだありません。</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {exemptList.map((period) => (
                    <li
                      key={exemptionKey(period)}
                      className="rounded-default border border-border p-4"
                      data-testid={`exempt-period-${exemptionKey(period)}`}
                    >
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-ink">
                          🗓️ {formatSlashDateWithWeekday(period.startDate)} 〜{" "}
                          {formatSlashDateWithWeekday(period.endDate)}
                        </p>
                        <StatusBadge tone="muted">
                          {exemptionDayCount(period)}日間
                        </StatusBadge>
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
                        {editingExemptKey === exemptionKey(period) ? (
                          <label className="flex flex-1 flex-col gap-1 text-xs text-ink sm:max-w-xs">
                            終了日を変更
                            <input
                              type="date"
                              className="min-h-touch rounded-default border border-border bg-surface px-3 py-2 text-base"
                              defaultValue={period.endDate}
                              data-testid={`exempt-end-input-${exemptionKey(period)}`}
                              onBlur={(e) => {
                                if (e.target.value !== period.endDate) {
                                  updateExemptMutation.mutate({
                                    startDate: period.startDate,
                                    endDate: period.endDate,
                                    newEndDate: e.target.value,
                                  });
                                }
                                setEditingExemptKey(null);
                              }}
                            />
                          </label>
                        ) : (
                          <Button
                            variant="ghost"
                            className="sm:w-[180px]"
                            onClick={() =>
                              setEditingExemptKey(exemptionKey(period))
                            }
                          >
                            終了日を変更
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          className="sm:w-[180px]"
                          disabled={removeExemptMutation.isPending}
                          onClick={() =>
                            removeExemptMutation.mutate({
                              startDate: period.startDate,
                              endDate: period.endDate,
                            })
                          }
                        >
                          削除
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card className="flex flex-col gap-4" data-testid="bedtime-card">
            <h2 className="text-ink">⏰ 当日の就寝時刻</h2>
            {bedtimeChange.allowed ? (
              <>
                <p className="text-sm text-muted">
                  候補は {PARENT_BEDTIME_HOUR_OPTIONS.join(" / ")} のみです。初期は21時。子どもは18時まで、保護者は回答提出前かつ就寝1時間前まで変更できます。期限を過ぎた時刻は表示されません。
                </p>
                <div className="flex flex-wrap gap-3" data-testid="bedtime-options">
                  {selectableBedtimeHours.map((hour) => {
                    const selected = bedtimeHour === hour;
                    return (
                      <button
                        key={hour}
                        type="button"
                        className={[
                          "flex min-h-touch w-[120px] items-center justify-center rounded-[12px] border-2 text-xl font-semibold",
                          selected
                            ? "border-primary bg-primary text-white"
                            : "border-primary bg-surface text-primary",
                        ].join(" ")}
                        onClick={() => setBedtimeHour(hour)}
                      >
                        {hour}:00
                      </button>
                    );
                  })}
                </div>
                <Button
                  fullWidth
                  disabled={
                    bedtimeMutation.isPending ||
                    !selectableBedtimeHours.includes(bedtimeHour)
                  }
                  onClick={() => bedtimeMutation.mutate(bedtimeHour)}
                  data-testid="bedtime-save"
                >
                  就寝時刻を保存
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted" data-testid="bedtime-change-blocked">
                {bedtimeChange.message ||
                  "現在は就寝時刻を変更できません（回答提出前〜就寝1時間前のみ）。"}
              </p>
            )}
          </Card>
        </div>

        <Button fullWidth variant="secondary" onClick={() => navigate("/parent")}>
          保護者ホームへ
        </Button>
      </div>
    </ParentPageFrame>
  );
}
