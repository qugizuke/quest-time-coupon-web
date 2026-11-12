/**
 * @file 保護者モードの認証セッション
 * @description Cloud Functions の `parentLogin` が発行した期限付きトークンを
 *   Session Storage に保持する。PIN の照合はサーバのみで行い、フロントには
 *   パスワードも照合ロジックも置かない（screen-design §5.1.1・契約 v1）。
 *   token は `Authorization: Bearer` で送る。cookie は App Hosting から
 *   Cloud Functions へのクロスサイトになるため使わない。
 * @limitation token はサーバが署名した文字列をそのまま保持するだけで、
 *   フロントでは検証しない（401 を受けたら破棄して再入力へ戻す）。
 */

/** @type {string} Session Storage キー（token と期限） */
export const PARENT_AUTH_KEY = "qtc:parentAuth";

/** @type {string} 旧 as-is キー（削除のみ行う） */
const LEGACY_GRADE_AUTH_KEY = "qtc:gradeAuth";

/** @type {string} 401・期限切れを画面へ通知するイベント名 */
export const PARENT_UNAUTHORIZED_EVENT = "qtc:parent-unauthorized";

/** @type {number} expiresAt が解釈できないときのフォールバック TTL（契約は3600秒） */
export const PARENT_AUTH_FALLBACK_TTL_MS = 60 * 60 * 1000;

/** Session Storage に保存する認証セッション */
export interface ParentAuthSession {
  /** サーバ発行の署名付きトークン（`v1.<payload>.<sig>`） */
  token: string;
  /** 絶対期限（Unix ms） */
  expiresAt: number;
}

/**
 * 期限表現（ISO8601 / epoch 秒 / epoch ms）を Unix ms へ正規化する
 * @param {string | number} value - サーバが返した期限
 * @returns {number} Unix ms。解釈できないときは 0
 */
export function normalizeExpiresAt(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0;
    // 1e12 未満は epoch 秒として扱う（契約は ISO 文字列だが寛容に受ける）
    return value < 1_000_000_000_000 ? Math.round(value * 1000) : value;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 保存済みセッションを読み込む
 * @returns {ParentAuthSession | null} 有効なセッション。未保存・不正・期限切れは null
 */
function readSession(): ParentAuthSession | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    sessionStorage.removeItem(LEGACY_GRADE_AUTH_KEY);
    const raw = sessionStorage.getItem(PARENT_AUTH_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ParentAuthSession>;
    if (typeof parsed.token !== "string" || parsed.token === "") {
      sessionStorage.removeItem(PARENT_AUTH_KEY);
      return null;
    }
    if (
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      sessionStorage.removeItem(PARENT_AUTH_KEY);
      return null;
    }
    if (parsed.expiresAt <= Date.now()) {
      sessionStorage.removeItem(PARENT_AUTH_KEY);
      return null;
    }
    return { token: parsed.token, expiresAt: parsed.expiresAt };
  } catch (error) {
    console.error("readSession: 認証セッションの読み込みに失敗", error);
    try {
      sessionStorage.removeItem(PARENT_AUTH_KEY);
    } catch {
      // Storage 自体が使えない環境では何もしない
    }
    return null;
  }
}

/**
 * 認証の残存有効時間（ミリ秒）を返す
 * @returns {number} 残存 TTL（ms）。未認証・期限切れは 0
 */
export function getParentAuthRemainingMs(): number {
  const session = readSession();
  if (!session) return 0;
  return Math.max(0, session.expiresAt - Date.now());
}

/**
 * 保護者モードに認証済みか
 * @returns {boolean} 有効なトークンがあり期限内なら true
 */
export function isParentAuthed(): boolean {
  return getParentAuthRemainingMs() > 0;
}

/**
 * サーバが返したトークンでセッションを開始する
 * @param {object} session - トークンと期限
 * @param {string} session.token - 署名付きトークン
 * @param {string | number} session.expiresAt - 期限（ISO8601 を正とする）
 * @returns {void}
 */
export function setParentSession(session: {
  token: string;
  expiresAt: string | number;
}): void {
  const expiresAt = normalizeExpiresAt(session.expiresAt);
  if (session.token === "" || expiresAt <= Date.now()) {
    throw new Error(
      "setParentSession: トークンまたは期限が不正です（parentLogin の応答を確認してください）",
    );
  }
  const record: ParentAuthSession = { token: session.token, expiresAt };
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(PARENT_AUTH_KEY, JSON.stringify(record));
    sessionStorage.removeItem(LEGACY_GRADE_AUTH_KEY);
  } catch (error) {
    console.error("setParentSession: Session Storage への書き込みに失敗", error);
    throw error;
  }
}

/**
 * 付与すべきトークンを返す
 * @returns {string | null} 有効なトークン。未認証は null
 */
export function getParentToken(): string | null {
  return readSession()?.token ?? null;
}

/**
 * 保護者モードの認証を解除する
 * @returns {void}
 */
export function clearParentAuthed(): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.removeItem(PARENT_AUTH_KEY);
    sessionStorage.removeItem(LEGACY_GRADE_AUTH_KEY);
  } catch (error) {
    console.error("clearParentAuthed: Session Storage の削除に失敗", error);
  }
}

/**
 * 401 を受けたことを画面へ通知する（ParentGuard が再ゲートする）
 * @returns {void}
 */
export function notifyParentUnauthorized(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PARENT_UNAUTHORIZED_EVENT));
}
