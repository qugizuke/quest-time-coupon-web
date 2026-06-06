/**
 * @file LoadingScreen
 * @description データ取得中の全画面ローディング表示。
 */
import { AppLayout } from "@/components/layout/AppLayout";

/**
 * 読み込み中画面（上下左右中央）
 * @returns {JSX.Element} ローディング UI
 */
export function LoadingScreen() {
  return (
    <AppLayout>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted">読み込み中…</p>
      </div>
    </AppLayout>
  );
}
