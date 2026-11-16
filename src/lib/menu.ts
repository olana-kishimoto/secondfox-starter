import type { ComponentType } from "react";
import { IconOrder, IconPlus, IconMaster, IconSettings, IconUsers } from "@/components/icons";
import type { Level } from "@/lib/perm";

export type MenuItem = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  group?: string;
  hidden?: boolean;
  also?: string[];
  feature?: string;
  minLevel?: Level;
};

// 業務の流れ順に並べる。設定系は最後の「設定」グループへ。
// 新しい画面を足したら MAIN_MENU に追加し、features シードにも insert する運用。
export const MAIN_MENU: MenuItem[] = [
  // 業務
  { key: "cases",    label: "案件一覧",  href: "/",               icon: IconOrder,    group: "業務", also: ["/cases"], feature: "cases",     minLevel: "view" },
  { key: "case_new", label: "案件登録",  href: "/cases/new",      icon: IconPlus,     group: "業務",                   feature: "cases",     minLevel: "edit" },
  // 設定
  { key: "master",   label: "顧客マスタ", href: "/master",        icon: IconMaster,   group: "設定",                   feature: "customers", minLevel: "view" },
  { key: "users",    label: "ユーザー",   href: "/settings/users", icon: IconUsers,    group: "設定", also: ["/settings/users"], feature: "users", minLevel: "manage" },
  { key: "roles",    label: "権限マスタ", href: "/settings/roles", icon: IconSettings, group: "設定", also: ["/settings/roles"], feature: "roles", minLevel: "manage" },
];

// モバイルのタブバー用（5項目まで）
export const TAB_MENU: MenuItem[] = [
  { key: "cases",    label: "案件",   href: "/",          icon: IconOrder,  feature: "cases",     minLevel: "view" },
  { key: "case_new", label: "登録",   href: "/cases/new", icon: IconPlus,   feature: "cases",     minLevel: "edit" },
  { key: "master",   label: "マスタ", href: "/master",    icon: IconMaster, feature: "customers", minLevel: "view" },
];

// pathname がその項目に当たるときの一致の長さ（0 = 当たらない）。最長一致の判定に使う。
export function menuMatchLength(item: MenuItem, pathname: string): number {
  let best = 0;
  for (const h of [item.href, ...(item.also ?? [])]) {
    const hit = h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(`${h}/`);
    if (hit) best = Math.max(best, h === item.href ? h.length : h.length - 1);
  }
  return best;
}
