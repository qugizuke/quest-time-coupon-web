/**
 * @file ParentSettingsPage
 * @description 保護者設定（長期休み・免除期間・当日就寝 21/22/23）。
 *   長期休み・免除は longVacation / questExemptions API（id なし・期間キー）。
 *   就寝編集可否は parentHome.canEditBedtimeAsParent を正とする。
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
import { todayLocal } from "@/lib/date";
import { evaluateParentBedtimeChange } from "@/lib/homeMode";
import type { BedtimeHour, ExemptionPeriod } from "@/types/api";

/** 就寝候補（仕様正・22:30 不可） */
const BEDTIME_OPTIONS: BedtimeHour[] = [21, 22, 23];

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
  }, [parentHome, today]);

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
      <h1 className="mb-4 text-app-lg font-bold text-ink">設定</h1>
      {message && (
        <p className="mb-4 rounded-default bg-info-soft px-3 py-2 text-sm text-info">
          {message}
        </p>
      )}

      <Card className="mb-4" data-testid="long-vacation-card">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">長期休みモード</h2>
          <StatusBadge tone={vacationConfigured ? "info" : "muted"}>
            {vacationConfigured ? "設定あり" : "未設定"}
          </StatusBadge>
        </div>
        <p className="mb-3 text-sm text-muted">{VACATION_HELP}</p>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            開始日
            <input
              type="date"
              className="rounded-default border-[3px] border-border px-3 py-2"
              value={vacationDraft.startDate}
              onChange={(e) =>
                setVacationDraft((v) => ({ ...v, startDate: e.target.value }))
              }
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            終了日
            <input
              type="date"
              className="rounded-default border-[3px] border-border px-3 py-2"
              value={vacationDraft.endDate}
              onChange={(e) =>
                setVacationDraft((v) => ({ ...v, endDate: e.target.value }))
              }
            />
          </label>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="flex-1"
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
          {vacationConfigured && (
            <Button
              className="flex-1"
              variant="secondary"
              disabled={endVacationMutation.isPending}
              onClick={() => endVacationMutation.mutate()}
            >
              終了
            </Button>
          )}
        </div>
      </Card>

      <Card className="mb-4" data-testid="quest-exemptions-card">
        <h2 className="mb-2 font-bold text-ink">クエスト免除</h2>
        <p className="mb-3 text-sm text-muted">
          期間の追加・削除・終了日変更ができます（メモなし）。
        </p>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <label className="flex flex-1 flex-col gap-1 text-sm">
            開始日
            <input
              type="date"
              className="rounded-default border-[3px] border-border px-3 py-2"
              value={exemptStart}
              onChange={(e) => setExemptStart(e.target.value)}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm">
            終了日
            <input
              type="date"
              className="rounded-default border-[3px] border-border px-3 py-2"
              value={exemptEnd}
              onChange={(e) => setExemptEnd(e.target.value)}
            />
          </label>
        </div>
        <Button
          className="mb-4"
          fullWidth
          variant="secondary"
          disabled={addExemptMutation.isPending}
          onClick={() => addExemptMutation.mutate()}
        >
          期間を追加
        </Button>
        {exemptList.length === 0 ? (
          <p className="text-sm text-muted">免除期間はまだありません。</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {exemptList.map((period) => (
              <li
                key={exemptionKey(period)}
                className="rounded-default border border-border-soft p-3"
                data-testid={`exempt-period-${exemptionKey(period)}`}
              >
                <p className="mb-2 text-sm font-medium">
                  {period.startDate} 〜 {period.endDate}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="flex flex-1 flex-col gap-1 text-sm">
                    終了日を変更
                    <input
                      type="date"
                      className="rounded-default border-[3px] border-border px-3 py-2"
                      defaultValue={period.endDate}
                      onBlur={(e) => {
                        if (e.target.value !== period.endDate) {
                          updateExemptMutation.mutate({
                            startDate: period.startDate,
                            endDate: period.endDate,
                            newEndDate: e.target.value,
                          });
                        }
                      }}
                    />
                  </label>
                  <Button
                    variant="danger"
                    className="sm:w-auto"
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
      </Card>

      <Card className="mb-4">
        <h2 className="mb-2 font-bold text-ink">当日の就寝（保護者変更）</h2>
        {bedtimeChange.allowed ? (
          <>
            <p className="mb-3 text-sm text-muted">
              候補は 21 / 22 / 23 のみです（仕様勝ち・22:30 なし）。回答提出前かつ就寝1時間前まで変更できます。
            </p>
            <div className="mb-3 flex gap-2">
              {BEDTIME_OPTIONS.map((hour) => (
                <Button
                  key={hour}
                  className="flex-1"
                  variant={bedtimeHour === hour ? "primary" : "secondary"}
                  onClick={() => setBedtimeHour(hour)}
                >
                  {hour}時
                </Button>
              ))}
            </div>
            <Button
              fullWidth
              disabled={bedtimeMutation.isPending}
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

      <Button fullWidth variant="secondary" onClick={() => navigate("/parent")}>
        保護者ホームへ
      </Button>
    </ParentPageFrame>
  );
}
