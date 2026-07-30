/**
 * @file ParentHomePage
 * @description 保護者ホーム（未採点・登録状況・再開・長期休み参照・設定）。
 *   データはモック可（本接続は Issue F）。見た目最終合わせは Issue #19。
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { postRegistrationReopen } from "@/api/client";
import { gradeDatesQuery, homeQuery, queryKeys } from "@/api/queries";
import { ParentPageFrame } from "@/components/layout/ParentPageFrame";
import { LoadingScreen } from "@/components/layout/LoadingScreen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { todayLocal } from "@/lib/date";
import { isPastQuestRegistrationCutoff } from "@/lib/deadline";
import {
  getVacationPeriod,
  hasUsedRegistrationReopen,
  isExemptOn,
  isVacationActiveOn,
} from "@/lib/parentLocalSettings";

/** 登録状況ラベル */
type RegistrationStatusLabel =
  | "未登録"
  | "登録済"
  | "締切超過"
  | "免除";

/**
 * 再開終了候補（現在以降・30分刻み・〜23:30）を返す
 * @param {Date} [now] - 現在時刻
 * @returns {Array<{ value: string; label: string }>} 候補
 */
function buildReopenUntilOptions(
  now: Date = new Date(),
): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  const cursor = new Date(now);
  cursor.setSeconds(0, 0);
  const minute = cursor.getMinutes();
  const nextSlot = minute === 0 || minute === 30 ? minute : minute < 30 ? 30 : 60;
  if (nextSlot === 60) {
    cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
  } else {
    cursor.setMinutes(nextSlot, 0, 0);
  }
  if (cursor.getTime() <= now.getTime()) {
    cursor.setMinutes(cursor.getMinutes() + 30);
  }
  const end = new Date(now);
  end.setHours(23, 30, 0, 0);
  while (cursor.getTime() <= end.getTime()) {
    const hh = String(cursor.getHours()).padStart(2, "0");
    const mm = String(cursor.getMinutes()).padStart(2, "0");
    options.push({
      value: cursor.toISOString(),
      label: `${hh}:${mm}`,
    });
    cursor.setMinutes(cursor.getMinutes() + 30);
  }
  return options;
}

/**
 * 保護者ホーム
 * @returns {JSX.Element} ページ
 */
export function ParentHomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const today = todayLocal();
  const { data: home, isLoading: homeLoading, error: homeError } = useQuery(homeQuery);
  const {
    data: gradeDates,
    isLoading: gradesLoading,
    error: gradesError,
  } = useQuery(gradeDatesQuery);
  const [reopenUntil, setReopenUntil] = useState("");
  const [reopenOpen, setReopenOpen] = useState(false);

  const ungradedCount = useMemo(
    () =>
      (gradeDates?.dates ?? []).filter((d) => d.status === "ungraded").length,
    [gradeDates],
  );

  const registrationStatus: RegistrationStatusLabel = useMemo(() => {
    if (home?.isExemptDay || isExemptOn(today)) return "免除";
    if (
      home?.todayStatus === "answered_ungraded" ||
      home?.todayStatus === "pending_ack" ||
      home?.todayStatus === "completed"
    ) {
      if (home.todayStatus === "answered_ungraded") return "登録済";
      // pending_ack / completed は未登録ペナルティ日の可能性あり
      const todayGrade = gradeDates?.dates.find((d) => d.date === today);
      if (todayGrade?.status === "ungraded" || todayGrade?.status === "graded") {
        return "登録済";
      }
      if (home.todayStatus === "pending_ack" || home.todayStatus === "completed") {
        return "締切超過";
      }
    }
    if (home?.todayStatus === "unanswered") {
      const past = isPastQuestRegistrationCutoff(today, new Date(), home.bedtimeHour);
      return past ? "締切超過" : "未登録";
    }
    return "未登録";
  }, [home, gradeDates, today]);

  const canReopen = useMemo(() => {
    if (!home) return false;
    if (home.isExemptDay || isExemptOn(today)) return false;
    if (hasUsedRegistrationReopen(today)) return false;
    if (registrationStatus !== "締切超過") return false;
    const todayGrade = gradeDates?.dates.find((d) => d.date === today);
    if (todayGrade?.status === "ungraded" || todayGrade?.status === "graded") {
      return false;
    }
    return true;
  }, [home, registrationStatus, gradeDates, today]);

  const reopenOptions = useMemo(() => buildReopenUntilOptions(), []);

  const vacationPeriod = getVacationPeriod();
  const vacationActive = isVacationActiveOn(today) || (home?.isVacationMode ?? false);

  const reopenMutation = useMutation({
    mutationFn: (endsAt: string) =>
      postRegistrationReopen({ date: today, endsAt }),
    onSuccess: () => {
      setReopenOpen(false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.home });
      void queryClient.invalidateQueries({ queryKey: queryKeys.gradeDates });
    },
  });

  if (homeLoading || gradesLoading) {
    return <LoadingScreen />;
  }

  if (homeError || gradesError) {
    const err = homeError ?? gradesError;
    return (
      <ParentPageFrame>
        <p className="text-danger">
          {err instanceof Error ? err.message : "読み込みに失敗しました"}
        </p>
      </ParentPageFrame>
    );
  }

  const registrationTone =
    registrationStatus === "免除"
      ? "info"
      : registrationStatus === "登録済"
        ? "success"
        : registrationStatus === "締切超過"
          ? "danger"
          : "warning";

  return (
    <ParentPageFrame>
      <h1 className="mb-4 text-app-lg font-bold text-ink">保護者ホーム</h1>

      <Card className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">未採点</h2>
          <StatusBadge tone={ungradedCount > 0 ? "warning" : "muted"}>
            {ungradedCount}件
          </StatusBadge>
        </div>
        <Button fullWidth onClick={() => navigate("/parent/grades")}>
          採点をはじめる
        </Button>
      </Card>

      <Card className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">登録状況</h2>
          <StatusBadge tone={registrationTone}>{registrationStatus}</StatusBadge>
        </div>
        {(home?.isExemptDay || isExemptOn(today)) && (
          <p className="text-sm text-muted">今日はクエスト免除です</p>
        )}
      </Card>

      {canReopen && (
        <Card className="mb-4">
          <h2 className="mb-2 font-bold text-ink">登録受付を再開</h2>
          <p className="mb-3 text-sm text-muted">
            当日1回のみ。終了時刻を選んで子どもが登録できるようにします。
          </p>
          {!reopenOpen ? (
            <Button
              fullWidth
              variant="secondary"
              onClick={() => {
                setReopenOpen(true);
                setReopenUntil(reopenOptions[0]?.value ?? "");
              }}
            >
              登録受付を再開
            </Button>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span>終了時刻</span>
                <select
                  className="rounded-default border-[3px] border-border bg-surface px-3 py-2"
                  value={reopenUntil}
                  onChange={(e) => setReopenUntil(e.target.value)}
                >
                  {reopenOptions.length === 0 ? (
                    <option value="">候補がありません</option>
                  ) : (
                    reopenOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))
                  )}
                </select>
              </label>
              {reopenMutation.error && (
                <p className="text-sm text-danger">
                  {reopenMutation.error instanceof Error
                    ? reopenMutation.error.message
                    : "再開に失敗しました"}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={!reopenUntil || reopenMutation.isPending}
                  onClick={() => reopenMutation.mutate(reopenUntil)}
                >
                  再開する
                </Button>
                <Button
                  className="flex-1"
                  variant="secondary"
                  onClick={() => setReopenOpen(false)}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Card className="mb-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">長期休み</h2>
          <StatusBadge tone={vacationActive ? "info" : "muted"}>
            {vacationActive ? "モード中" : "オフ"}
          </StatusBadge>
        </div>
        {vacationPeriod ? (
          <p className="text-sm text-muted">
            {vacationPeriod.startDate} 〜 {vacationPeriod.endDate}
            （変更は設定へ）
          </p>
        ) : (
          <p className="text-sm text-muted">期間未設定。操作は設定から行えます。</p>
        )}
      </Card>

      <Button
        fullWidth
        variant="secondary"
        onClick={() => navigate("/parent/settings")}
      >
        設定
      </Button>
    </ParentPageFrame>
  );
}
