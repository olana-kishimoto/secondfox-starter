// 役割の判定（サーバーにもテストにも使える純関数。ここは何にも依存しない）。
// 「隠す＝守る」ではない。画面の出し分けはこの関数で行うが、守るべきデータは DB の RLS でも閉じること（supabase/migrations/0003_roles.sql）。
export const ADMIN_ROLE = "admin";   // 予約の特別役割。全部見える。それ以外の役割名は各システムが roles テーブルで決める。

// 役割の名前（キー）として使える形。小文字の英字で始まる 2〜31 文字（英小文字・数字・_）。DB の check と同じ。
export const ROLE_KEY_RE = /^[a-z][a-z0-9_]{1,30}$/;
export const roleKeyProblem = (k: string): string | null =>
  ROLE_KEY_RE.test(k) ? null : "役割のキーは、英小文字で始まる2〜31文字の英小文字・数字・_ にしてください。";

export const isAdminRole = (role: string | null | undefined) => role === ADMIN_ROLE;

// その役割で許されるか。管理者は常に true。役割なし（null）は false。allowed が空なら管理者だけ。
export function roleAllows(role: string | null | undefined, allowed: readonly string[]): boolean {
  if (!role) return false;
  if (role === ADMIN_ROLE) return true;
  return allowed.includes(role);
}

// 画面の項目（メニューなど）を役割で出し分ける。roles を持たない項目は、ログイン済みなら全員に出す（従来どおり）。
export function filterByRole<T extends { roles?: readonly string[] }>(items: readonly T[], role: string | null | undefined): T[] {
  return items.filter((it) => !it.roles || roleAllows(role, it.roles));
}
