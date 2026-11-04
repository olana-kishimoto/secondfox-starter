import { getUser } from "@/lib/supabase/server";
import { currentRole } from "@/lib/roles";
import { AppShell } from "./AppShell";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await getUser();
  const role = await currentRole();   // サーバーで判定してメニューの出し分けに渡す
  return <AppShell email={me?.email ?? undefined} role={role}>{children}</AppShell>;
}
