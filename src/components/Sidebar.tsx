"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { MAIN_MENU } from "@/lib/menu";
import { IconSidebarCollapse } from "@/components/icons";
import { APP_NAME, APP_SUB } from "@/lib/app-info";
import { menuMatchLength } from "@/lib/menu";

export function Sidebar({
  email,
  onCollapse,
}: {
  email?: string | null;
  onCollapse?: () => void;
}) {
  const pathname = usePathname();

  const groups = Array.from(
    new Set(MAIN_MENU.filter((m) => !m.hidden).map((m) => m.group).filter((g): g is string => !!g)),
  );

  // 前方一致でぶつかる項目（例: /cases と /cases/new）は「最長一致」だけを点灯
  const activeHref = (() => {
    let best: { href: string; len: number } | null = null;
    for (const m of MAIN_MENU) {
      const len = menuMatchLength(m, pathname);
      if (len > 0 && (!best || len > best.len)) best = { href: m.href, len };
    }
    return best?.href ?? null;
  })();

  // アクティブ項目が属するグループを初期開放
  const activeGroup =
    MAIN_MENU.find((m) => m.href === activeHref)?.group ?? groups[0] ?? null;

  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);

  // ページ遷移でグループが変わったら自動展開
  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup);
  }, [activeGroup]);

  function toggleGroup(group: string) {
    setOpenGroup((prev) => (prev === group ? null : group));
  }

  return (
    <aside className="hidden w-[200px] shrink-0 flex-col border-r border-line bg-base px-3 py-5 md:flex">
      {/* ロゴ + トグル */}
      <div className="border-b border-line pb-4">
        <div className="flex items-start justify-between gap-2 px-1">
          <Link href="/" className="inline-block">
            <span className="text-[13px] font-bold tracking-[0.14em] text-accent">
              {APP_NAME}
            </span>
          </Link>
          {onCollapse && (
            <button
              type="button"
              onClick={onCollapse}
              aria-label="サイドメニューを閉じる"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted hover:bg-surface hover:text-accent"
            >
              <IconSidebarCollapse size={14} />
            </button>
          )}
        </div>
        <div className="mt-2 px-1 text-[8.5px] uppercase tracking-[0.34em] text-muted">
          {APP_SUB}
        </div>
        <div className="mt-2.5 ml-1 h-[2px] w-[26px] bg-accent" />
      </div>

      {/* グループ（アコーディオン） */}
      {groups.map((group) => {
        const isOpen = openGroup === group;
        const items = MAIN_MENU.filter((m) => m.group === group && !m.hidden);
        return (
          <div key={group} className="mt-4">
            <button
              type="button"
              onClick={() => toggleGroup(group)}
              className="mb-1 flex w-full items-center justify-between px-2 text-[9px] uppercase tracking-[0.26em] text-muted hover:text-text transition-colors"
            >
              <span>{group}</span>
              <Chevron open={isOpen} />
            </button>

            {isOpen && (
              <div>
                {items.map((item) => {
                  const active = item.href === activeHref;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      className={active ? pillActive() : navItem()}
                    >
                      <Icon size={active ? 16 : 15} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* フッタ */}
      {email && (
        <div className="mt-auto border-t border-line pt-4">
          <div className="px-2 text-[10px] tracking-[0.04em] text-muted" title={email}>
            <span className="block truncate">{email}</span>
          </div>
        </div>
      )}
    </aside>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      className={`shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        d="M2 3.5L5 6.5L8 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function navItem(extra = "") {
  return [
    "flex items-center gap-2 rounded px-2.5 py-2",
    "text-[12px] tracking-[0.06em] text-text",
    "hover:bg-surface hover:text-accent",
    extra,
  ].join(" ");
}

function pillActive() {
  return [
    "flex items-center gap-2 rounded px-2.5 py-2",
    "text-[12px] font-medium tracking-[0.06em]",
    "bg-surface text-accent border border-line",
  ].join(" ");
}
