import { getUser } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { MAIN_MENU, TAB_MENU } from "@/lib/menu";
import { AppShell } from "./AppShell";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await getUser();
  const perms = me ? await getMyPerms() : {};
  const menuItems = MAIN_MENU.filter((m) => !m.feature || can(perms, m.feature, m.minLevel ?? "view"));
  const tabItems = TAB_MENU.filter((m) => !m.feature || can(perms, m.feature, m.minLevel ?? "view"));
  return (
    <AppShell email={me?.email ?? undefined} menuItems={menuItems} tabItems={tabItems}>
      {children}
    </AppShell>
  );
}
