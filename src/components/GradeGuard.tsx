/**
 * @file GradeGuard
 * @description 採点画面への未認証アクセスをログインへリダイレクトする。
 */
import { Navigate, Outlet } from "react-router-dom";
import { isGradeAuthed } from "@/lib/gradeAuth";

/**
 * 採点ルートガード
 * @returns {JSX.Element} 子ルートまたはリダイレクト
 */
export function GradeGuard() {
  if (!isGradeAuthed()) {
    return <Navigate to="/grade/login" replace />;
  }
  return <Outlet />;
}
