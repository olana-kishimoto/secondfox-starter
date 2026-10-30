"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

// 画面上部の細いトッププログレスバー。
// リンククリック/フォーム送信で即「進行中」を表示し、遷移完了（pathname/searchParams 変化）で消す。
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [width, setWidth] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  const start = () => {
    clearTimers();
    setActive(true);
    setWidth(8);
    // じわっと進めて 90% で待機（完了時に 100%）
    timers.current.push(setTimeout(() => setWidth(45), 80));
    timers.current.push(setTimeout(() => setWidth(75), 300));
    timers.current.push(setTimeout(() => setWidth(90), 800));
    // フォールバック（遷移しない送信で固まらないよう自動解除）
    timers.current.push(setTimeout(() => { setWidth(100); setTimeout(() => setActive(false), 250); }, 10000));
  };

  // クリック/送信を監視して即開始
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest?.("a");
      if (!a) return;
      const href = a.getAttribute("href");
      const target = a.getAttribute("target");
      if (!href || href.startsWith("#") || target === "_blank" || a.hasAttribute("download")) return;
      // 同一オリジンの内部遷移のみ
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      } catch { return; }
      start();
    };
    const onSubmit = () => start();
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  // 遷移完了で 100% → フェードアウト
  useEffect(() => {
    if (!active) return;
    clearTimers();
    setWidth(100);
    const t = setTimeout(() => { setActive(false); setWidth(0); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[2px]">
      <div
        className="h-full bg-accent transition-[width,opacity] duration-200 ease-out"
        style={{ width: `${width}%`, opacity: active ? 1 : 0 }}
      />
    </div>
  );
}
