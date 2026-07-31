/**
 * @file React Router 定義
 * @description 子ども5パス＋保護者 `/parent*`＋旧 `/grade*` 必須リダイレクト（Issue #15）。
 */
import { createBrowserRouter, Navigate } from "react-router-dom";
import { ParentGuard } from "@/components/ParentGuard";
import { resolveRouterBasename } from "@/lib/routerBasename";
import { GradeDatePage } from "@/pages/GradeDatePage";
import { GradeListPage } from "@/pages/GradeListPage";
import { HomePage } from "@/pages/HomePage";
import { ParentHomePage } from "@/pages/ParentHomePage";
import { ParentSettingsPage } from "@/pages/ParentSettingsPage";
import { QuestConfirmPage } from "@/pages/QuestConfirmPage";
import { QuestPage } from "@/pages/QuestPage";
import { ResultsPage } from "@/pages/ResultsPage";
import { TimerPage } from "@/pages/TimerPage";
import { GradeDateRedirect } from "@/routes/GradeDateRedirect";

/** アプリルーター */
const basename = resolveRouterBasename(import.meta.env.BASE_URL);

export const router = createBrowserRouter(
  [
    { path: "/", element: <HomePage /> },
    { path: "/quest", element: <QuestPage /> },
    { path: "/quest/confirm", element: <QuestConfirmPage /> },
    { path: "/results", element: <ResultsPage /> },
    { path: "/timer", element: <TimerPage /> },
    {
      path: "/parent",
      element: <ParentGuard />,
      children: [
        { index: true, element: <ParentHomePage /> },
        { path: "grades", element: <GradeListPage /> },
        { path: "grades/:date", element: <GradeDatePage /> },
        { path: "settings", element: <ParentSettingsPage /> },
      ],
    },
    // 旧パス — 必須リダイレクト（CEO 決定。* へ落とさない）
    { path: "/grade/login", element: <Navigate to="/parent" replace /> },
    { path: "/grade", element: <Navigate to="/parent/grades" replace /> },
    { path: "/grade/:date", element: <GradeDateRedirect /> },
    { path: "*", element: <Navigate to="/" replace /> },
  ],
  { basename },
);
