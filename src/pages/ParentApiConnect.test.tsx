/**
 * @file ParentHomePage / ParentSettingsPage の parentHome・API 接続テスト
 * @description parentHome を画面正とし、再開 CTA / 長期休み / 免除 / 就寝許可を検証する。
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { queryKeys } from "@/api/queries";
import { ParentHomePage } from "@/pages/ParentHomePage";
import { ParentSettingsPage } from "@/pages/ParentSettingsPage";
import type {
  LongVacationData,
  ParentHomeData,
  QuestExemptionsData,
} from "@/types/api";

/**
 * ParentHomeData を組み立てる
 * @param {Partial<ParentHomeData>} [overrides] - 上書き
 * @returns {ParentHomeData} ParentHomeData
 */
function buildParentHome(
  overrides: Partial<ParentHomeData> = {},
): ParentHomeData {
  return {
    date: "2026-07-30",
    ungradedCount: 2,
    todayRegistrationStatus: "closed_unregistered",
    registrationReopen: {
      available: true,
      used: false,
      endsAt: null,
      setAt: null,
      isOpen: false,
    },
    isExemptToday: false,
    isLongVacation: false,
    longVacation: { startDate: "", endDate: "", active: false },
    bedtimeHour: 21,
    canEditBedtimeAsParent: false,
    questDeadlineAt: null,
    ...overrides,
  };
}

/**
 * 保護者ページを描画する
 * @param {object} opts - データ
 * @returns {void}
 */
function renderParentPages(opts: {
  path: "/parent" | "/parent/settings";
  parentHome: ParentHomeData;
  longVacation?: LongVacationData;
  exemptions?: QuestExemptionsData;
}): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  queryClient.setQueryData(queryKeys.parentHome, opts.parentHome);
  queryClient.setQueryData(
    queryKeys.longVacation,
    opts.longVacation ?? {
      startDate: "",
      endDate: "",
      updatedAt: "",
      active: false,
    },
  );
  queryClient.setQueryData(
    queryKeys.questExemptions,
    opts.exemptions ?? { periods: [], updatedAt: "" },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[opts.path]}>
        <Routes>
          <Route path="/parent" element={<ParentHomePage />} />
          <Route path="/parent/settings" element={<ParentSettingsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ParentHomePage parentHome", () => {
  afterEach(() => {
    cleanup();
  });

  it("registrationReopen.available のとき再開 CTA を出す", () => {
    renderParentPages({
      path: "/parent",
      parentHome: buildParentHome({
        todayRegistrationStatus: "closed_unregistered",
        registrationReopen: {
          available: true,
          used: false,
          endsAt: null,
          setAt: null,
          isOpen: false,
        },
      }),
    });
    expect(screen.getByTestId("registration-reopen-card")).toBeTruthy();
    expect(screen.getByText("締切超過")).toBeTruthy();
  });

  it("再開フォーム展開時に終了時刻の選択肢を表示する", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-30T22:00:00+09:00"));
    try {
      renderParentPages({
        path: "/parent",
        parentHome: buildParentHome({
          date: "2026-07-30",
          todayRegistrationStatus: "closed_unregistered",
          registrationReopen: {
            available: true,
            used: false,
            endsAt: null,
            setAt: null,
            isOpen: false,
          },
        }),
      });

      fireEvent.click(screen.getByRole("button", { name: "登録受付を再開" }));

      const select = screen.getByTestId(
        "reopen-ends-at-select",
      ) as HTMLSelectElement;
      const labels = [...select.options].map((option) => option.textContent);
      expect(labels).toEqual(["22:30", "23:00", "23:30"]);
      expect(select.value).toBe("2026-07-30T22:30:00+09:00");
    } finally {
      vi.useRealTimers();
    }
  });

  it("used 済みなら再開 CTA を出さない", () => {
    renderParentPages({
      path: "/parent",
      parentHome: buildParentHome({
        todayRegistrationStatus: "closed_unregistered",
        registrationReopen: {
          available: false,
          used: true,
          endsAt: "2026-07-30T20:00:00+09:00",
          setAt: "2026-07-30T19:00:00+09:00",
          isOpen: false,
        },
      }),
    });
    expect(screen.queryByTestId("registration-reopen-card")).toBeNull();
  });

  it("longVacation を parentHome から表示する", () => {
    renderParentPages({
      path: "/parent",
      parentHome: buildParentHome({
        isLongVacation: true,
        longVacation: {
          startDate: "2026-07-20",
          endDate: "2026-08-10",
          active: true,
        },
      }),
    });
    expect(screen.getByText("モード中")).toBeTruthy();
    expect(screen.getByTestId("vacation-period").textContent).toContain(
      "2026-07-20",
    );
  });
});

describe("ParentSettingsPage API 接続", () => {
  afterEach(() => {
    cleanup();
  });

  it("longVacation / questExemptions を API データから表示する", () => {
    renderParentPages({
      path: "/parent/settings",
      parentHome: buildParentHome(),
      longVacation: {
        startDate: "2026-07-20",
        endDate: "2026-08-10",
        updatedAt: "2026-07-19T10:00:00+09:00",
        active: true,
      },
      exemptions: {
        periods: [
          {
            startDate: "2026-07-25",
            endDate: "2026-07-26",
            createdAt: "2026-07-24T10:00:00+09:00",
          },
        ],
        updatedAt: "2026-07-24T10:00:00+09:00",
      },
    });
    expect(screen.getByTestId("long-vacation-card")).toBeTruthy();
    expect(screen.getByText("設定あり")).toBeTruthy();
    expect(
      screen.getByTestId("exempt-period-2026-07-25|2026-07-26"),
    ).toBeTruthy();
  });

  it("canEditBedtimeAsParent=true なら正午前でも就寝保存 UI を出す", () => {
    renderParentPages({
      path: "/parent/settings",
      parentHome: buildParentHome({
        isLongVacation: true,
        canEditBedtimeAsParent: true,
        todayRegistrationStatus: "open_unregistered",
        bedtimeHour: 22,
      }),
    });
    expect(screen.getByTestId("bedtime-save")).toBeTruthy();
    expect(screen.queryByTestId("bedtime-change-blocked")).toBeNull();
  });

  it("canEditBedtimeAsParent=false なら就寝変更を遮断する", () => {
    renderParentPages({
      path: "/parent/settings",
      parentHome: buildParentHome({
        canEditBedtimeAsParent: false,
        isExemptToday: true,
        todayRegistrationStatus: "exempt",
      }),
    });
    expect(screen.getByTestId("bedtime-change-blocked")).toBeTruthy();
    expect(screen.queryByTestId("bedtime-save")).toBeNull();
  });
});
