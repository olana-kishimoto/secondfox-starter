/**
 * スプレッドシート数式インジェクション対策済み CSV セル値エスケープ。
 * 先頭が = + - @ タブ CR のいずれかなら ' をプレフィックスして無害化。
 * ダブルクォートは二重化し、値全体をクォートで囲む。
 */
export function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  const dangerPrefix = /^[=+\-@\t\r]/.test(s);
  const sanitized = dangerPrefix ? "'" + s : s;
  const escaped = sanitized.replace(/"/g, '""');
  return `"${escaped}"`;
}
