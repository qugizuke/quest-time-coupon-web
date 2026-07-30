/**
 * @file 保護者モードのパスワード認証
 * @description Session Storage で `/parent*` へのアクセス可否を保持する。
 *   認証後1時間で失効する（screen-design.md §5.1.1）。
 * @limitation パスワードはフロント内定数（家庭内利用向け）。サーバ照合 API は作らない。
 */

/** @type {string} 保護者モードパスワード（CEO 決定・現行踏襲） */
export const PARENT_PASSWORD = "0119";

/** @type {number} パスワード試行上限 */
export const MAX_PARENT_PASSWORD_ATTEMPTS = 3;

/** @type {number} 認証有効時間（1時間・ミリ秒） */
export const PARENT_AUTH_TTL_MS = 60 * 60 * 1000;

/** @type {string} Session Storage キー（to-be） */
const PARENT_AUTH_KEY = "qtc:parentAuth";

/** @type {string} 旧 as-is キー（一度だけ移行） */
const LEGACY_GRADE_AUTH_KEY = "qtc:gradeAuth";

/** Session Storage に保存する認証記録 */
interface ParentAuthRecord {
  /** @type {number} 認証成功時刻（Unix ms） */
  authedAt: number;
}

/**
 * 旧 `qtc:gradeAuth` を `qtc:parentAuth` へ移す
 * @returns {void}
 */
function migrateLegacyAuthKey(): void {
  try {
    if (sessionStorage.getItem(PARENT_AUTH_KEY)) {
      sessionStorage.removeItem(LEGACY_GRADE_AUTH_KEY);
      return;
    }
    const legacy = sessionStorage.getItem(LEGACY_GRADE_AUTH_KEY);
    if (!legacy) return;
    sessionStorage.setItem(PARENT_AUTH_KEY, legacy);
    sessionStorage.removeItem(LEGACY_GRADE_AUTH_KEY);
  } catch (error) {
    console.error(
      "migrateLegacyAuthKey: 旧 gradeAuth キーの移行に失敗",
      error,
    );
  }
}

/**
 * 認証記録を読み込む
 * @returns {ParentAuthRecord | null} 記録。不正・未保存時 null
 */
function readAuthRecord(): ParentAuthRecord | null {
  migrateLegacyAuthKey();
  try {
    const raw = sessionStorage.getItem(PARENT_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ParentAuthRecord;
    if (typeof parsed.authedAt !== "number") return null;
    return parsed;
  } catch (error) {
    console.error(
      "readAuthRecord: 認証記録の読み込みに失敗 raw解析エラー",
      error,
    );
    return null;
  }
}

/**
 * 認証の残存有効時間（ミリ秒）を返す
 * @description 期限切れなら記録を削除して 0 を返す。
 * @returns {number} 残存 TTL（ms）。未認証・期限切れは 0
 */
export function getParentAuthRemainingMs(): number {
  const record = readAuthRecord();
  if (!record) return 0;

  const remaining = PARENT_AUTH_TTL_MS - (Date.now() - record.authedAt);
  if (remaining <= 0) {
    clearParentAuthed();
    return 0;
  }

  return remaining;
}

/**
 * 保護者モードに認証済みか
 * @returns {boolean} 認証済みかつ有効期限内なら true
 */
export function isParentAuthed(): boolean {
  return getParentAuthRemainingMs() > 0;
}

/**
 * 保護者モードを認証済みにする
 * @returns {void}
 */
export function setParentAuthed(): void {
  const record: ParentAuthRecord = { authedAt: Date.now() };
  try {
    sessionStorage.setItem(PARENT_AUTH_KEY, JSON.stringify(record));
    sessionStorage.removeItem(LEGACY_GRADE_AUTH_KEY);
  } catch (error) {
    console.error(
      "setParentAuthed: Session Storage への書き込みに失敗",
      { record },
      error,
    );
    throw error;
  }
}

/**
 * 保護者モードの認証を解除する
 * @returns {void}
 */
export function clearParentAuthed(): void {
  try {
    sessionStorage.removeItem(PARENT_AUTH_KEY);
    sessionStorage.removeItem(LEGACY_GRADE_AUTH_KEY);
  } catch (error) {
    console.error("clearParentAuthed: Session Storage の削除に失敗", error);
  }
}

/**
 * パスワードが一致するか
 * @param {string} input - 入力値
 * @returns {boolean} 一致時 true
 */
export function verifyParentPassword(input: string): boolean {
  return input === PARENT_PASSWORD;
}
