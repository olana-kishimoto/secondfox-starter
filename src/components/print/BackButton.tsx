"use client";

import { useRef, useState } from "react";

/**
 * 連打ガード付き「戻る／閉じる」ボタン（印刷帳票共通）。
 * - 2回目以降のクリックは ref でブロックし disabled 表示にする
 * - history あり → history.back()、新規タブ → window.close() → 失敗時にメッセージ表示
 * - ラベルは history の有無で「戻る」/「閉じる」を自動切替
 */
export function BackButton({ className }: { className?: string }) {
  const firedRef = useRef(false);
  const [disabled, setDisabled] = useState(false);
  const [closeBlocked, setCloseBlocked] = useState(false);
  // SSR は window なし → false。クライアント再描画時に正確な値を返す。
  const hasHistory = typeof window !== "undefined" && window.history.length > 1;

  function handleClick() {
    if (firedRef.current) return;
    firedRef.current = true;
    setDisabled(true);
    if (hasHistory) {
      history.back();
    } else {
      window.close();
      // window.close() は opener なし・新規タブでないとブロックされることがある
      setTimeout(() => {
        if (!window.closed) setCloseBlocked(true);
      }, 300);
    }
  }

  return (
    <>
      {closeBlocked && (
        <span className="text-[11px] text-muted">このタブを閉じてください</span>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        className={`${className ?? ""}${disabled ? " cursor-not-allowed opacity-40" : ""}`}
      >
        {hasHistory ? "戻る" : "閉じる"}
      </button>
    </>
  );
}
