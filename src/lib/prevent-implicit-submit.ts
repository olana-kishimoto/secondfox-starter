import type { KeyboardEvent } from "react";

/**
 * Enter による暗黙のフォーム送信を抑止する onKeyDown ハンドラ。
 * 以下は通す:
 *   - textarea 内（改行）
 *   - type="submit" / type="image" のボタン自身（明示的な確定）
 *   - IME 変換中（e.isComposing / keyCode 229）
 * テーブル内の Enter ナビ（tableEnterNav）はこのハンドラより先に
 * 子要素のonKeyDown で処理されるため干渉しない。
 */
export function preventImplicitSubmit(e: KeyboardEvent<HTMLFormElement>) {
  if (e.key !== "Enter") return;
  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
  const target = e.target as HTMLElement;
  if (target.tagName === "TEXTAREA") return;
  if (target.tagName === "BUTTON") {
    const t = target as HTMLButtonElement;
    if (t.type === "submit") return;
  }
  if (target.tagName === "INPUT") {
    const t = target as HTMLInputElement;
    if (t.type === "submit" || t.type === "image") return;
  }
  e.preventDefault();
}
