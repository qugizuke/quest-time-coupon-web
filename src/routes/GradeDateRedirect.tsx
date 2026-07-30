/**
 * @file GradeDateRedirect
 * @description 旧 `/grade/:date` を `/parent/grades/${date}` へ必須リダイレクトする。
 *   `useParams` で date を展開する（リテラル `:date` 禁止・screen-design §8.6）。
 */
import { Navigate, useParams } from "react-router-dom";

/**
 * date パラメータから保護者採点詳細パスを組み立てる
 * @param {string | undefined} date - URL パラメータ
 * @returns {string} 遷移先パス
 */
export function resolveParentGradesPath(date: string | undefined): string {
  if (!date) {
    return "/parent/grades";
  }
  return `/parent/grades/${date}`;
}

/**
 * 旧採点詳細 URL の date 保持リダイレクト
 * @returns {JSX.Element} Navigate
 */
export function GradeDateRedirect() {
  const { date } = useParams<{ date: string }>();
  return <Navigate to={resolveParentGradesPath(date)} replace />;
}
