/**
 * @file routerBasename
 * @description Vite の BASE_URL から React Router の basename を導出する。
 */

/**
 * Vite の BASE_URL から React Router の basename を導出する。
 * @param {string} baseUrl - import.meta.env.BASE_URL（末尾 `/` 付き）
 * @returns {string | undefined} basename（ルート配信時は undefined）
 */
export function resolveRouterBasename(baseUrl: string): string | undefined {
  if (baseUrl === "/") return undefined;
  return baseUrl.replace(/\/$/, "");
}
