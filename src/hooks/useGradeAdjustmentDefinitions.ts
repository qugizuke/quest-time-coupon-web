/**
 * @file useGradeAdjustmentDefinitions
 * @description public/adjustments/grade.json を読み込む。
 */
import { useQuery } from "@tanstack/react-query";
import type { GradeAdjustmentDefinitions } from "@/types/api";

/**
 * 保護者裁量の加減点項目定義を取得する
 * @returns {ReturnType<typeof useQuery<GradeAdjustmentDefinitions>>} クエリ結果
 */
export function useGradeAdjustmentDefinitions() {
  return useQuery({
    queryKey: ["gradeAdjustmentDefinitions"],
    queryFn: async (): Promise<GradeAdjustmentDefinitions> => {
      const res = await fetch(`${import.meta.env.BASE_URL}adjustments/grade.json`);
      if (!res.ok) {
        throw new Error(
          `useGradeAdjustmentDefinitions: grade.json の取得に失敗 status=${res.status}`,
        );
      }
      return res.json() as Promise<GradeAdjustmentDefinitions>;
    },
    staleTime: Infinity,
  });
}
