/**
 * @file API クライアントの単体テスト
 * @description Cloud Functions への切替で決めた呼び出し規約を固定する。
 *   - リクエスト先は `${VITE_API_URL}?action=...`（末尾スラッシュは除去）
 *   - 認証はヘッダー `X-Api-Key` のみ（クエリ `?key=` は使わない）
 *   - POST の Content-Type は `application/json`
 *   - `VITE_MOCK_API=true` のときだけモックを使う
 * @limitation クライアントはモジュール読み込み時に環境変数を確定させるため、
 *   各テストで `vi.stubEnv` → `vi.resetModules` → 動的 import の順で読み直す。
 */
import { afterEach, describe, expect, it, vi } from "vitest";

/** @type {string} テスト用の API ベース URL（Functions `api` 関数相当） */
const API_BASE = "https://asia-northeast1-quest-time-coupon-95106.cloudfunctions.net/api";

/**
 * JSON レスポンスを作る
 * @param {unknown} body - レスポンス本体
 * @param {number} [status] - HTTP ステータス
 * @returns {Response} fetch のモック用レスポンス
 */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * fetch をモックに差し替える
 * @param {Response} response - 返却するレスポンス
 * @returns {ReturnType<typeof vi.fn>} 呼び出し内容を検証できるモック関数
 */
function stubFetch(response: Response) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => response);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/**
 * 環境変数を反映した状態でクライアントを読み込む
 * @returns {Promise<typeof import("./client")>} クライアントモジュール
 */
async function importClient(): Promise<typeof import("./client")> {
  vi.resetModules();
  return import("./client");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("client リクエスト組み立て", () => {
  it("action クエリと X-Api-Key ヘッダで GET する（末尾スラッシュは除去）", async () => {
    vi.stubEnv("VITE_API_URL", `${API_BASE}/`);
    vi.stubEnv("VITE_API_KEY", "test-key");
    vi.stubEnv("VITE_MOCK_API", "false");
    const fetchMock = stubFetch(jsonResponse({ ok: true, data: { displayBalance: 12 } }));

    const { fetchHome } = await importClient();
    const data = await fetchHome("2026-07-28");

    expect(data).toEqual({ displayBalance: 12 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}?action=home&date=2026-07-28`);
    expect(url).not.toContain("key=test-key");
    expect(init?.headers).toMatchObject({ "X-Api-Key": "test-key" });
  });

  it("POST は application/json と X-Api-Key を同時に送る", async () => {
    vi.stubEnv("VITE_API_URL", API_BASE);
    vi.stubEnv("VITE_API_KEY", "test-key");
    vi.stubEnv("VITE_MOCK_API", "false");
    const fetchMock = stubFetch(
      jsonResponse({ ok: true, data: { submittedAt: "2026-07-28T10:00:00+09:00", overwritten: false } }),
    );

    const { postAnswers } = await importClient();
    await postAnswers({ date: "2026-07-28", answers: [] });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}?action=answers`);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Api-Key": "test-key",
    });
  });

  it("VITE_API_URL 未設定なら設定箇所を示すエラーを投げる", async () => {
    vi.stubEnv("VITE_API_URL", "");
    vi.stubEnv("VITE_MOCK_API", "false");
    const fetchMock = stubFetch(jsonResponse({ ok: true, data: {} }));

    const { fetchHome } = await importClient();

    await expect(fetchHome("2026-07-28")).rejects.toThrow(
      /VITE_API_URL が未設定です（action=home）/,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("VITE_API_URL 未設定なら旧 VITE_GAS_URL があってもフォールバックしない", async () => {
    vi.stubEnv("VITE_API_URL", undefined);
    vi.stubEnv("VITE_GAS_URL", "https://script.google.com/macros/s/legacy/exec");
    vi.stubEnv("VITE_MOCK_API", "false");
    const fetchMock = stubFetch(jsonResponse({ ok: true, data: {} }));

    const { fetchHome } = await importClient();

    await expect(fetchHome("2026-07-28")).rejects.toThrow(/VITE_API_URL が未設定です/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("API がエラーを返したら code とメッセージを含めて投げる", async () => {
    vi.stubEnv("VITE_API_URL", API_BASE);
    vi.stubEnv("VITE_MOCK_API", "false");
    stubFetch(
      jsonResponse({ ok: false, error: { code: "UNAUTHORIZED", message: "認証エラー" } }, 401),
    );

    const { fetchHome } = await importClient();

    await expect(fetchHome("2026-07-28")).rejects.toThrow("UNAUTHORIZED: 認証エラー");
  });

  it("JSON でないレスポンスは status を含めたエラーにする", async () => {
    vi.stubEnv("VITE_API_URL", API_BASE);
    vi.stubEnv("VITE_MOCK_API", "false");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>error</html>", { status: 500 })),
    );

    const { fetchHome } = await importClient();

    await expect(fetchHome("2026-07-28")).rejects.toThrow(
      /レスポンスの JSON 解析に失敗しました（action=home, status=500/,
    );
  });
});

describe("client モック切替", () => {
  it("VITE_MOCK_API=true なら fetch せずモックを返す", async () => {
    vi.stubEnv("VITE_API_URL", API_BASE);
    vi.stubEnv("VITE_MOCK_API", "true");
    const fetchMock = stubFetch(jsonResponse({ ok: true, data: {} }));

    const { fetchHome } = await importClient();
    const home = await fetchHome("2026-07-28");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(home).toHaveProperty("todayStatus");
  });

  it("VITE_MOCK_API 未設定ならモックを使わない", async () => {
    vi.stubEnv("VITE_API_URL", API_BASE);
    vi.stubEnv("VITE_MOCK_API", undefined);
    const fetchMock = stubFetch(jsonResponse({ ok: true, data: { displayBalance: 0 } }));

    const { fetchHome } = await importClient();
    await fetchHome("2026-07-28");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
