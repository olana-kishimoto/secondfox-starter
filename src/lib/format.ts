// 金額: 整数表示 + カンマ区切り
export function formatYen(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "—";
  return `¥${Math.round(num).toLocaleString("ja-JP")}`;
}

// 数字のみ（金額の右寄せセル用）
export function formatNumber(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "—";
  return Math.round(num).toLocaleString("ja-JP");
}

// 数量: 小数1桁（0.0 形式）
export function formatQty(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "—";
  return Number(num.toFixed(1)).toLocaleString("ja-JP", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

// タイムスタンプ文字列 → JST "YYYY/MM/DD HH:MM"（サーバー・クライアント両用）
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// タイムスタンプ文字列 → JST 日付のみ "YYYY/MM/DD"（サーバー・クライアント両用）
export function formatDateJST(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// "YYYY-MM-DD" → "YYYY/MM/DD"
export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "—";
  return `${m[1]}/${m[2]}/${m[3]}`;
}

// "YYYY/MM" 表示用
export function formatMonth(date: string | null | undefined): string {
  if (!date) return "—";
  const m = date.match(/^(\d{4})-(\d{2})/);
  if (!m) return "—";
  return `${m[1]}/${m[2]}`;
}

// date 文字列 (YYYY-MM-DD) を <input type="month"> 用 (YYYY-MM) に整形
export function toMonthInputValue(date: string | null | undefined): string {
  if (!date) return "";
  return date.slice(0, 7);
}

// 入力された月文字列を YYYY-MM-01 の date 文字列に正規化
export function normalizeMonthInput(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const m = s.match(/^(\d{4})-(\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${m[2].padStart(2, "0")}-01`;
}

// 数値入力を number に。空 / 不正は default
export function parseNumber(
  v: FormDataEntryValue | null,
  defaultValue = 0,
): number {
  const s = String(v ?? "").trim().replace(/,/g, "");
  if (!s) return defaultValue;
  const n = Number(s);
  return Number.isFinite(n) ? n : defaultValue;
}

// 任意文字列。空文字なら null
export function nullableString(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s.length === 0 ? null : s;
}

// 日付入力（<input type="date">）の妥当な年範囲。年6桁入力を防ぐための共通制約。
export const DATE_INPUT_MIN = "2020-01-01";
export const DATE_INPUT_MAX = "2099-12-31";

// 入力日付が "YYYY-MM-DD"（年4桁・妥当範囲）かを検証。OKなら正規化文字列、NGなら null。
export function validateDateInput(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  // 年は厳密に4桁（type=date でも min/max 無しだと6桁が通るため明示チェック）
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, , mm, dd] = m;
  if (s < DATE_INPUT_MIN || s > DATE_INPUT_MAX) return null;
  const mo = Number(mm), da = Number(dd);
  if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  return s;
}

// 会期など「開始〜終了」の期間検証。OKなら null、NGならエラーメッセージ。
export function validatePeriod(start: FormDataEntryValue | null, end: FormDataEntryValue | null): string | null {
  const s = validateDateInput(start);
  const e = validateDateInput(end);
  if (!s) return "会期開始は 2020〜2099 年の正しい日付で入力してください";
  if (!e) return "会期終了は 2020〜2099 年の正しい日付で入力してください";
  if (e < s) return "会期終了は会期開始以降の日付にしてください";
  return null;
}
