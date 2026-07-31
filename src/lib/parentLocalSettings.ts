/**
 * @file 保護者設定のローカルモック
 * @description 長期休み・免除期間・登録再開・就寝上書きを localStorage で保持する。
 *   本接続（Issue F）前の UI 用。mock API の休暇／免除フラグと同期する。
 * @limitation 永続は端末ローカルのみ。API 契約の正式化は F。
 */

/** @type {string} 長期休み期間キー */
const VACATION_KEY = "qtc:mock:vacationPeriod";

/** @type {string} 免除期間一覧キー */
const EXEMPT_PERIODS_KEY = "qtc:mock:exemptPeriods";

/** @type {string} 登録再開使用フラグ（日付ごと） */
const REOPEN_USED_KEY = "qtc:mock:reopenUsed";

/** @type {string} 再開受付終了時刻（日付 → ISO） */
const REOPEN_UNTIL_KEY = "qtc:mock:reopenUntilByDate";

/** @type {string} mock.ts と共有する長期休みフラグ */
export const MOCK_VACATION_FLAG_KEY = "qtc:mock:vacation";

/** @type {string} mock.ts と共有する当日免除フラグ */
export const MOCK_EXEMPT_FLAG_KEY = "qtc:mock:exempt";

/** 長期休み期間 */
export interface VacationPeriod {
  /** @type {string} 開始日 YYYY-MM-DD */
  startDate: string;
  /** @type {string} 終了日 YYYY-MM-DD */
  endDate: string;
}

/** クエスト免除期間 */
export interface ExemptPeriod {
  /** @type {string} 一意 ID */
  id: string;
  /** @type {string} 開始日 YYYY-MM-DD */
  startDate: string;
  /** @type {string} 終了日 YYYY-MM-DD */
  endDate: string;
}

/**
 * localStorage から JSON を読む
 * @template T
 * @param {string} key - キー
 * @returns {T | null} パース結果
 */
function readJson<T>(key: string): T | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`readJson: 読み込み失敗 key=${key}`, error);
    return null;
  }
}

/**
 * localStorage に JSON を書く
 * @param {string} key - キー
 * @param {unknown} value - 値
 * @returns {void}
 */
function writeJson(key: string, value: unknown): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`writeJson: 書き込み失敗 key=${key}`, error);
  }
}

/**
 * 日付が期間内か（両端含む）
 * @param {string} date - YYYY-MM-DD
 * @param {string} startDate - 開始
 * @param {string} endDate - 終了
 * @returns {boolean} 期間内なら true
 */
export function isDateInRange(
  date: string,
  startDate: string,
  endDate: string,
): boolean {
  return date >= startDate && date <= endDate;
}

/**
 * 長期休み期間を取得する
 * @returns {VacationPeriod | null} 期間
 */
export function getVacationPeriod(): VacationPeriod | null {
  return readJson<VacationPeriod>(VACATION_KEY);
}

/**
 * 指定日が長期休みモード中か
 * @param {string} date - YYYY-MM-DD
 * @returns {boolean} モード中なら true
 */
export function isVacationActiveOn(date: string): boolean {
  const period = getVacationPeriod();
  if (!period) return false;
  return isDateInRange(date, period.startDate, period.endDate);
}

/**
 * 長期休み期間を設定し、当日フラグを同期する
 * @param {VacationPeriod | null} period - 期間（null で解除）
 * @param {string} today - 今日 YYYY-MM-DD
 * @returns {void}
 */
export function setVacationPeriod(
  period: VacationPeriod | null,
  today: string,
): void {
  try {
    if (typeof localStorage === "undefined") return;
    if (!period) {
      localStorage.removeItem(VACATION_KEY);
      localStorage.setItem(MOCK_VACATION_FLAG_KEY, "0");
      return;
    }
    if (period.startDate > period.endDate) {
      throw new Error(
        `setVacationPeriod: 開始日が終了日より後です start=${period.startDate} end=${period.endDate}`,
      );
    }
    writeJson(VACATION_KEY, period);
    localStorage.setItem(
      MOCK_VACATION_FLAG_KEY,
      isDateInRange(today, period.startDate, period.endDate) ? "1" : "0",
    );
  } catch (error) {
    console.error("setVacationPeriod: 保存失敗", error);
    throw error;
  }
}

/**
 * 免除期間一覧を取得する
 * @returns {ExemptPeriod[]} 期間一覧
 */
export function getExemptPeriods(): ExemptPeriod[] {
  return readJson<ExemptPeriod[]>(EXEMPT_PERIODS_KEY) ?? [];
}

/**
 * 指定日が免除日か
 * @param {string} date - YYYY-MM-DD
 * @returns {boolean} 免除なら true
 */
export function isExemptOn(date: string): boolean {
  return getExemptPeriods().some((p) =>
    isDateInRange(date, p.startDate, p.endDate),
  );
}

/**
 * 免除期間を保存し、当日フラグを同期する
 * @param {ExemptPeriod[]} periods - 期間一覧
 * @param {string} today - 今日
 * @returns {void}
 */
export function setExemptPeriods(periods: ExemptPeriod[], today: string): void {
  writeJson(EXEMPT_PERIODS_KEY, periods);
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(
      MOCK_EXEMPT_FLAG_KEY,
      isExemptOn(today) ? "1" : "0",
    );
  } catch (error) {
    console.error("setExemptPeriods: 当日フラグ同期失敗", error);
  }
}

/**
 * 免除期間を追加する
 * @param {Omit<ExemptPeriod, "id">} period - 期間
 * @param {string} today - 今日
 * @returns {ExemptPeriod} 追加した期間
 */
export function addExemptPeriod(
  period: Omit<ExemptPeriod, "id">,
  today: string,
): ExemptPeriod {
  if (period.startDate > period.endDate) {
    throw new Error(
      `addExemptPeriod: 開始日が終了日より後です start=${period.startDate} end=${period.endDate}`,
    );
  }
  const next: ExemptPeriod = {
    ...period,
    id: `exempt-${Date.now()}`,
  };
  setExemptPeriods([...getExemptPeriods(), next], today);
  return next;
}

/**
 * 免除期間を削除する
 * @param {string} id - 期間 ID
 * @param {string} today - 今日
 * @returns {void}
 */
export function removeExemptPeriod(id: string, today: string): void {
  setExemptPeriods(
    getExemptPeriods().filter((p) => p.id !== id),
    today,
  );
}

/**
 * 免除期間の終了日を変更する
 * @param {string} id - 期間 ID
 * @param {string} endDate - 新終了日
 * @param {string} today - 今日
 * @returns {void}
 */
export function updateExemptPeriodEnd(
  id: string,
  endDate: string,
  today: string,
): void {
  const periods = getExemptPeriods().map((p) => {
    if (p.id !== id) return p;
    if (p.startDate > endDate) {
      throw new Error(
        `updateExemptPeriodEnd: 終了日が開始日より前です id=${id} end=${endDate}`,
      );
    }
    return { ...p, endDate };
  });
  setExemptPeriods(periods, today);
}

/**
 * 当日の登録再開を既に使ったか
 * @param {string} date - YYYY-MM-DD
 * @returns {boolean} 使用済みなら true
 */
export function hasUsedRegistrationReopen(date: string): boolean {
  const used = readJson<Record<string, boolean>>(REOPEN_USED_KEY) ?? {};
  return used[date] === true;
}

/**
 * 登録再開を使用済みにする
 * @param {string} date - YYYY-MM-DD
 * @returns {void}
 */
export function markRegistrationReopenUsed(date: string): void {
  const used = readJson<Record<string, boolean>>(REOPEN_USED_KEY) ?? {};
  used[date] = true;
  writeJson(REOPEN_USED_KEY, used);
}

/**
 * 再開受付の終了時刻を日付付きで保存する
 * @param {string} date - YYYY-MM-DD
 * @param {string} untilIso - ISO 日時
 * @returns {void}
 */
export function setReopenUntil(date: string, untilIso: string): void {
  const map = readJson<Record<string, string>>(REOPEN_UNTIL_KEY) ?? {};
  map[date] = untilIso;
  writeJson(REOPEN_UNTIL_KEY, map);
}

/**
 * 再開受付の終了時刻を日付付きで取得する
 * @param {string} date - YYYY-MM-DD
 * @returns {string | null} ISO 日時
 */
export function getReopenUntil(date: string): string | null {
  const map = readJson<Record<string, string>>(REOPEN_UNTIL_KEY) ?? {};
  return map[date] ?? null;
}

/**
 * テスト用に保護者ローカル設定をクリアする
 * @returns {void}
 */
export function clearParentLocalSettings(): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(VACATION_KEY);
    localStorage.removeItem(EXEMPT_PERIODS_KEY);
    localStorage.removeItem(REOPEN_USED_KEY);
    localStorage.removeItem(REOPEN_UNTIL_KEY);
    localStorage.removeItem(MOCK_VACATION_FLAG_KEY);
    localStorage.removeItem(MOCK_EXEMPT_FLAG_KEY);
  } catch (error) {
    console.error("clearParentLocalSettings: クリア失敗", error);
  }
}
