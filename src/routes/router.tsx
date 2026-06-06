/**
 * @file React Router 定義
 */
import { createBrowserRouter, Navigate } from "react-router-dom";
import { GradeGuard } from "@/components/GradeGuard";
import { GradeDatePage } from "@/pages/GradeDatePage";
import { GradeListPage } from "@/pages/GradeListPage";
import { GradeLoginPage } from "@/pages/GradeLoginPage";
import { HomePage } from "@/pages/HomePage";
import { QuestConfirmPage } from "@/pages/QuestConfirmPage";
import { QuestPage } from "@/pages/QuestPage";
import { ResultsPage } from "@/pages/ResultsPage";
import { TimerPage } from "@/pages/TimerPage";

/** アプリルーター */
export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/quest", element: <QuestPage /> },
  { path: "/quest/confirm", element: <QuestConfirmPage /> },
  { path: "/results", element: <ResultsPage /> },
  { path: "/timer", element: <TimerPage /> },
  { path: "/grade/login", element: <GradeLoginPage /> },
  {
    path: "/grade",
    element: <GradeGuard />,
    children: [
      { index: true, element: <GradeListPage /> },
      { path: ":date", element: <GradeDatePage /> },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);
