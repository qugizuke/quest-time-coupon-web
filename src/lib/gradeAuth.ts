/**
 * @file 保護者採点画面のパスワード認証
 * @description Session Storage で採点エリアへのアクセス可否を保持する。
 *   認証後1時間で失効する。
 * @limitation パスワードはフロント内定数（家庭内利用向け）
 */

/** @type {string} 採点画面パスワード */
export const GRADE_PASSWORD = "0119";

/** @type {number} パスワード試行上限 */
export const MAX_GRADE_PASSWORD_ATTEMPTS = 3;

/** @type {number} 認証有効時間（1時間・ミリ秒） */
export const GRADE_AUTH_TTL_MS = 60 * 60 * 1000;

/** @type {string} Session Storage キー */
const GRADE_AUTH_KEY = "qtc:gradeAuth";

/** Session Storage に保存する認証記録 */
interface GradeAuthRecord {
  /** @type {number} 認証成功時刻（Unix ms） */
  authedAt: number;
}

/**
 * 認証記録を読み込む
 * @returns {GradeAuthRecord | null} 記録。不正・未保存時 null
 */
function readAuthRecord(): GradeAuthRecord | null {
  try {
    const raw = sessionStorage.getItem(GRADE_AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GradeAuthRecord;
    if (typeof parsed.authedAt !== "number") return null;
    return parsed;
  } catch (error) {
    console.error("readAuthRecord: 認証記録の読み込みに失敗", error);
    return null;
  }
}

/**
 * 採点画面に認証済みか
 * @returns {boolean} 認証済みかつ有効期限内なら true
 */
export function isGradeAuthed(): boolean {
  const record = readAuthRecord();
  if (!record) return false;

  const elapsed = Date.now() - record.authedAt;
  if (elapsed >= GRADE_AUTH_TTL_MS) {
    clearGradeAuthed();
    return false;
  }

  return true;
}

/** 採点画面を認証済みにする */
export function setGradeAuthed(): void {
  const record: GradeAuthRecord = { authedAt: Date.now() };
  sessionStorage.setItem(GRADE_AUTH_KEY, JSON.stringify(record));
}

/** 採点画面の認証を解除する */
export function clearGradeAuthed(): void {
  sessionStorage.removeItem(GRADE_AUTH_KEY);
}

/**
 * パスワードが一致するか
 * @param {string} input - 入力値
 * @returns {boolean} 一致時 true
 */
export function verifyGradePassword(input: string): boolean {
  return input === GRADE_PASSWORD;
}
