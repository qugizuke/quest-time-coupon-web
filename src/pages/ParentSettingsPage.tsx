/**
 * @file ParentSettingsPage
 * @description 保護者設定（長期休み・免除期間・当日就寝 21/22/23）。
 *   Figma 差分は仕様勝ち: 就寝に 22:30 なし、D12 ボーナス増加文言なし。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postParentBedtime } from "@/api/client";
import { homeQuery, queryKeys } from "@/api/queries";
import { ParentPageFrame } from "@/components/layout/ParentPageFrame";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { todayLocal } from "@/lib/date";
import { evaluateParentBedtimeChange } from "@/lib/homeMode";
import {
  addExemptPeriod,
  getExemptPeriods,
  getVacationPeriod,
  removeExemptPeriod,
  setVacationPeriod,
  updateExemptPeriodEnd,
  type ExemptPeriod,
  type VacationPeriod,
} from "@/lib/parentLocalSettings";
import type { BedtimeHour } from "@/types/api";

/** 就寝候補（仕様正・22:30 不可） */
const BEDTIME_OPTIONS: BedtimeHour[] = [21, 22, 23];

/** 長期休み説明（D12 仕様勝ち） */
const VACATION_HELP =
  "長期休み期間中は、就寝・起床のルールが毎日適用されます。基本ボーナス時間は増加しません。";

/**
 * 保護者設定
 * @returns {JSX.Element} ページ
 */
export function ParentSettingsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = todayLocal();
  const { data: home, isLoading, error } = useQuery(homeQuery);

  const [vacationDraft, setVacationDraft] = useState<VacationPeriod>(() => {
    const current = getVacationPeriod();
    return current ?? { startDate: today, endDate: today };
  });
  const [exemptStart, setExemptStart] = useState(today);
  const [exemptEnd, setExemptEnd] = useState(today);
  const [exemptList, setExemptList] = useState<ExemptPeriod[]>(() => getExemptPeriods());
  const [vacation, setVacation] = useState<VacationPeriod | null>(() => getVacationPeriod());
  const [message, setMessage] = useState("");
  const [bedtimeHour, setBedtimeHour] = useState<BedtimeHour>(21);

  useEffect(() => {
    if (home?.bedtimeHour === 21 || home?.bedtimeHour === 22 || home?.bedtimeHour === 23) {
      setBedtimeHour(home.bedtimeHour);
    }
  }, [home?.bedtimeHour]);

  const bedtimeChange = useMemo(() => {
    if (!home) {
      return {
        allowed: false,
        reason: "not_today" as const,
        message: "読み込み中です",
      };
    }
    const hasAnswers = home.todayStatus === "answered_ungraded";
    const hasResult =
      home.todayStatus === "pending_ack" || home.todayStatus === "completed";
    return evaluateParentBedtimeChange({
      date: today,
      today,
      isExemptDay: Boolean(home.isExemptDay),
      isVacationMode: Boolean(home.isVacationMode),
      isWeekendEveDay: Boolean(home.isWeekendEve),
      hasAnswers,
      hasResult,
      bedtimeHour: home.bedtimeHour,
    });
  }, [home, today]);

  const bedtimeMutation = useMutation({
    mutationFn: (hour: BedtimeHour) =>
      postParentBedtime({ date: today, bedtimeHour: hour }),
    onSuccess: (saved) => {
      setBedtimeHour(saved.bedtimeHour as BedtimeHour);
      setMessage("就寝時刻を保存しました");
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    },
    onError: (err) => {
      setMessage(err instanceof Error ? err.message : "就寝の保存に失敗しました");
    },
  });

  /**
   * 長期休みを保存する
   * @returns {void}
   */
  function handleSaveVacation(): void {
    try {
      setVacationPeriod(vacationDraft, today);
      setVacation(getVacationPeriod());
      setMessage("長期休みモードを保存しました");
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "長期休みの保存に失敗しました");
    }
  }

  /**
   * 長期休みを終了する
   * @returns {void}
   */
  function handleEndVacation(): void {
    setVacationPeriod(null, today);
    setVacation(null);
    setMessage("長期休みモードを終了しました");
    void queryClient.invalidateQueries({ queryKey: queryKeys.home });
  }

  /**
   * 免除期間を追加する
   * @returns {void}
   */
  function handleAddExempt(): void {
    try {
      addExemptPeriod({ startDate: exemptStart, endDate: exemptEnd }, today);
      setExemptList(getExemptPeriods());
      setMessage("免除期間を追加しました");
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gradeDates });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "免除の追加に失敗しました");
    }
  }

  /**
   * 免除期間を削除する
   * @param {string} id - 期間 ID
   * @returns {void}
   */
  function handleRemoveExempt(id: string): void {
    removeExemptPeriod(id, today);
    setExemptList(getExemptPeriods());
    setMessage("免除期間を削除しました");
    void queryClient.invalidateQueries({ queryKey: queryKeys.home });
    void queryClient.invalidateQueries({ queryKey: queryKeys.gradeDates });
  }

  /**
   * 免除終了日を変更する
   * @param {string} id - 期間 ID
   * @param {string} endDate - 終了日
   * @returns {void}
   */
  function handleUpdateExemptEnd(id: string, endDate: string): void {
    try {
      updateExemptPeriodEnd(id, endDate, today);
      setExemptList(getExemptPeriods());
      setMessage("免除期間を更新しました");
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gradeDates });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "免除の更新に失敗しました");
    }
  }

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

      <Card className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">長期休みモード</h2>
          <StatusBadge tone={vacation ? "info" : "muted"}>
            {vacation ? "設定あり" : "未設定"}
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
          <Button className="flex-1" onClick={handleSaveVacation}>
            {vacation ? "期間を変更" : "設定する"}
          </Button>
          {vacation && (
            <Button className="flex-1" variant="secondary" onClick={handleEndVacation}>
              終了
            </Button>
          )}
        </div>
      </Card>

      <Card className="mb-4">
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
        <Button className="mb-4" fullWidth variant="secondary" onClick={handleAddExempt}>
          期間を追加
        </Button>
        {exemptList.length === 0 ? (
          <p className="text-sm text-muted">免除期間はまだありません。</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {exemptList.map((period) => (
              <li
                key={period.id}
                className="rounded-default border border-border-soft p-3"
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
                          handleUpdateExemptEnd(period.id, e.target.value);
                        }
                      }}
                    />
                  </label>
                  <Button
                    variant="danger"
                    className="sm:w-auto"
                    onClick={() => handleRemoveExempt(period.id)}
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
              候補は 21 / 22 / 23 のみです（仕様勝ち・22:30 なし）。子ども期限後〜就寝1時間前まで変更できます。
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
            >
              就寝時刻を保存
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted" data-testid="bedtime-change-blocked">
            {bedtimeChange.message ||
              "現在は就寝時刻を変更できません（子ども期限後〜就寝1時間前のみ）。"}
          </p>
        )}
      </Card>

      <Button fullWidth variant="secondary" onClick={() => navigate("/parent")}>
        保護者ホームへ
      </Button>
    </ParentPageFrame>
  );
}
