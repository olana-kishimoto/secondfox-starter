import type { ComponentType } from "react";
import { IconOrder, IconPlus, IconMaster } from "@/components/icons";
import { filterByRole } from "@/lib/roles-core";

export type MenuItem = {
  key: string;
  label: string;
  href: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  group?: string;
  hidden?: boolean;
  roles?: string[]; // この役割（と管理者）にだけ出す。省略すると、ログイン済みなら全員に出す。見た目の出し分けで、データを守るのは RLS（0003_roles.sql）
  also?: string[]; // この画面に属する他の URL の頭（例: 編集画面 /cases/…）
};

// 業務の流れ順に並べる。係は、この「業務」グループに画面を足していく（一覧 → 登録 → …の順）。
// マスタ・設定系は最後の「設定」グループへ。
export const MAIN_MENU: MenuItem[] = [
  // 業務
  { key: "cases",     label: "案件一覧", href: "/",          icon: IconOrder, group: "業務", also: ["/cases"] },
  { key: "case_new",  label: "案件登録", href: "/cases/new", icon: IconPlus,  group: "業務" },
  // 設定
  { key: "master",    label: "マスタ",   href: "/master",    icon: IconMaster, group: "設定" },
  // 役割を割り当てる（管理者だけ。roles が空＝管理者だけ）
  { key: "roles",     label: "利用者と役割", href: "/admin/roles", icon: IconMaster, group: "設定", roles: [] },
];

// モバイルのタブバー用（5項目まで）
export const TAB_MENU: MenuItem[] = [
  { key: "cases",    label: "案件",   href: "/",          icon: IconOrder },
  { key: "case_new", label: "登録",   href: "/cases/new", icon: IconPlus },
  { key: "master",   label: "マスタ", href: "/master",    icon: IconMaster },
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

// 役割で出し分けた一覧（サイドバー・タブ用）。役割は layout がサーバーで判定して渡す。
export const menuFor = (role: string | null | undefined) => filterByRole(MAIN_MENU, role);
export const tabsFor = (role: string | null | undefined) => filterByRole(TAB_MENU, role);
