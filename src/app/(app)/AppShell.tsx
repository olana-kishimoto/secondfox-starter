"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { NavProgress } from "@/components/NavProgress";
import { IconSidebarExpand, IconLogout } from "@/components/icons";
import { logout } from "@/app/login/actions";
import { APP_NAME } from "@/lib/app-info";
import type { Perms } from "@/lib/can";

const STORAGE_KEY = "app.sidebar.collapsed";

export function AppShell({
  email,
  perms,
  permsFailed,
  children,
}: {
  email?: string | null;
  perms?: Perms;
  permsFailed?: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch { /* ignore */ }
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try { window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-surface">
      <Suspense fallback={null}><NavProgress /></Suspense>
      {!collapsed && <Sidebar email={email} onCollapse={toggle} perms={perms} />}
      <div className="relative flex-1 min-w-0">
        {collapsed && (
          <button
            type="button"
            onClick={toggle}
            aria-label="サイドメニューを表示"
            className="absolute left-3 top-3 z-30 hidden h-8 w-8 items-center justify-center rounded border border-line bg-surface text-muted hover:border-accent hover:text-accent md:flex"
          >
            <IconSidebarExpand size={16} />
          </button>
        )}

        {/* モバイル top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-2 backdrop-blur md:hidden">
          <Link href="/" className="text-[12px] font-bold tracking-[0.16em] text-accent hover:opacity-80">
            {APP_NAME}
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/account" className="px-2 py-1 text-[11px] tracking-[0.06em] text-muted hover:text-accent">アカウント</Link>
            <form action={logout}>
              <button type="submit" aria-label="ログアウト" className="flex h-8 w-8 items-center justify-center rounded text-muted hover:text-accent">
                <IconLogout size={15} />
              </button>
            </form>
          </div>
        </div>

        <div className="pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0">
          {permsFailed && (
            <div className="px-4 pt-4 md:px-8 md:pt-6">
              <div className="notice bad">
                <p>権限情報を確認できませんでした。再読み込みするか担当者にご連絡ください。</p>
              </div>
            </div>
          )}
          {children}
        </div>
      </div>
      <MobileTabBar perms={perms} />
    </div>
  );
}
