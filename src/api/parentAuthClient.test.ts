/**
 * @file 保護者認証まわりの API クライアントテスト
 * @description 契約 v1 の前提を固定する。
 *   - `parentLogin` は POST で PIN を送り、トークンと期限を受け取る
 *   - トークンは `Authorization: Bearer` で送る（クエリ・body には載せない）
 *   - 保護者専用 action の 401 はセッション破棄＋再ゲート通知
 *   - 子専用 action の 401 ではセッションを壊さない
 *   - 429 は Retry-After を保持する
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearParentAuthed,
  getParentToken,
  isParentAuthed,
  PARENT_AUTH_KEY,
  PARENT_UNAUTHORIZED_EVENT,
  setParentSession,
} from "@/lib/parentAuth";

/** @type {string} テスト用の API ベース URL */
const API_BASE = "https://asia-northeast1-quest-time-coupon-95106.cloudfunctions.net/api";

/** @type {string} テスト用トークン（実トークンではない） */
const TEST_TOKEN = "v1.eyJzdWIiOiJwYXJlbnQifQ.signature";

/**
 * JSON レスポンスを作る
 * @param {unknown} body - レスポンス本体
 * @param {number} [status] - HTTP ステータス
 * @param {Record<string, string>} [headers] - 追加ヘッダー
 * @returns {Response} fetch のモック用レスポンス
 */
function jsonResponse(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
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

/**
 * 有効な保護者セッションを保存する
 * @returns {void}
 */
function signIn() {
  setParentSession({
    token: TEST_TOKEN,
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  });
}

beforeEach(() => {
  sessionStorage.clear();
  vi.stubEnv("VITE_API_URL", API_BASE);
  vi.stubEnv("VITE_API_KEY", "test-key");
  vi.stubEnv("VITE_MOCK_API", "false");
});

afterEach(() => {
  clearParentAuthed();
  sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("parentLogin", () => {
  it("PIN を POST し、トークンを保存できる形で返す", async () => {
    const expiresAt = new Date(Date.now() + 3_600_000).toISOString();
    const fetchMock = stubFetch(
      jsonResponse({ ok: true, data: { token: TEST_TOKEN, expiresAt } }),
    );
    const client = await importClient();

    const result = await client.postParentLogin({ pin: "1234" });

    expect(result).toEqual({ token: TEST_TOKEN, expiresAt });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}?action=parentLogin`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ pin: "1234" });
    expect(init?.headers).toMatchObject({ "X-Api-Key": "test-key" });
    expect(String(url)).not.toContain("1234");
    expect(String(url)).not.toContain("pin=");
  });

  it("失敗は ApiError の code で判別できる", async () => {
    stubFetch(
      jsonResponse(
        { ok: false, error: { code: "INVALID_CREDENTIALS", message: "パスワードが違います" } },
        401,
      ),
    );
    const client = await importClient();

    await expect(client.postParentLogin({ pin: "9999" })).rejects.toMatchObject({
      name: "ApiError",
      code: "INVALID_CREDENTIALS",
      status: 401,
    });
  });

  it("429 は Retry-After を秒で保持する", async () => {
    stubFetch(
      jsonResponse(
        { ok: false, error: { code: "RATE_LIMITED", message: "試行回数が上限です" } },
        429,
        { "Retry-After": "120" },
      ),
    );
    const client = await importClient();

    await expect(client.postParentLogin({ pin: "9999" })).rejects.toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
      retryAfterSeconds: 120,
    });
  });
});

describe("Authorization ヘッダ", () => {
  it("未ログイン時は Authorization を付けない", async () => {
    const fetchMock = stubFetch(jsonResponse({ ok: true, data: { displayBalance: 0 } }));
    const client = await importClient();

    await client.fetchHome("2026-07-28");

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).not.toHaveProperty("Authorization");
  });

  it("ログイン後は Bearer を付け、URL・body には載せない", async () => {
    signIn();
    const fetchMock = stubFetch(jsonResponse({ ok: true, data: { displayBalance: 0 } }));
    const client = await importClient();

    await client.fetchHome("2026-07-28");

    const [url, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toMatchObject({
      Authorization: `Bearer ${TEST_TOKEN}`,
    });
    expect(String(url)).not.toContain(TEST_TOKEN);
    expect(JSON.stringify(init?.body ?? "")).not.toContain(TEST_TOKEN);
  });

  it("保護者専用 action の 401 はセッションを破棄して再ゲート通知する", async () => {
    signIn();
    const fetchMock = stubFetch(
      jsonResponse({ ok: false, error: { code: "UNAUTHORIZED", message: "認証エラー" } }, 401),
    );
    const client = await importClient();
    const onUnauthorized = vi.fn();
    window.addEventListener(PARENT_UNAUTHORIZED_EVENT, onUnauthorized);

    await expect(client.fetchParentHome("2026-07-28")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(isParentAuthed()).toBe(false);
    expect(getParentToken()).toBeNull();
    expect(sessionStorage.getItem(PARENT_AUTH_KEY)).toBeNull();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_BASE}?action=parentHome&date=2026-07-28`);
    window.removeEventListener(PARENT_UNAUTHORIZED_EVENT, onUnauthorized);
  });

  it("子専用 action の 401 ではセッションを壊さない", async () => {
    signIn();
    stubFetch(
      jsonResponse({ ok: false, error: { code: "UNAUTHORIZED", message: "認証エラー" } }, 401),
    );
    const client = await importClient();

    await expect(client.fetchHome("2026-07-28")).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(isParentAuthed()).toBe(true);
  });

  it("registrationSetting は actor=parent のときだけ 401 で再ゲートする", async () => {
    signIn();
    const unauthorized = () =>
      jsonResponse(
        { ok: false, error: { code: "UNAUTHORIZED", message: "認証エラー" } },
        401,
      );
    const fetchMock = vi.fn(async () => unauthorized());
    vi.stubGlobal("fetch", fetchMock);
    const client = await importClient();
    const onUnauthorized = vi.fn();
    window.addEventListener(PARENT_UNAUTHORIZED_EVENT, onUnauthorized);

    await expect(
      client.postRegistrationSetting({
        date: "2026-07-28",
        bedtimeHour: 21,
        actor: "child",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(isParentAuthed()).toBe(true);

    await expect(
      client.postRegistrationSetting({
        date: "2026-07-28",
        bedtimeHour: 21,
        actor: "parent",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(isParentAuthed()).toBe(false);
    window.removeEventListener(PARENT_UNAUTHORIZED_EVENT, onUnauthorized);
  });
});

describe("モックの parentLogin", () => {
  it("4桁なら成功し、実 PIN に依存しない", async () => {
    vi.stubEnv("VITE_MOCK_API", "true");
    const fetchMock = stubFetch(jsonResponse({ ok: true, data: {} }));
    const client = await importClient();

    const result = await client.postParentLogin({ pin: "2468" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.token).toBeTruthy();
    expect(Number.isNaN(Date.parse(result.expiresAt))).toBe(false);
  });

  it("4桁でない入力は INVALID_CREDENTIALS にする", async () => {
    vi.stubEnv("VITE_MOCK_API", "true");
    stubFetch(jsonResponse({ ok: true, data: {} }));
    const client = await importClient();

    await expect(client.postParentLogin({ pin: "12" })).rejects.toThrow(
      /INVALID_CREDENTIALS/,
    );
  });
});
