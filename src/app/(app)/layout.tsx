import { getUser } from "@/lib/supabase/server";
import { getMyPerms } from "@/lib/perm";
import { AppShell } from "./AppShell";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await getUser();
  const perms = me ? await getMyPerms() : {};
  return (
    <AppShell email={me?.email ?? undefined} perms={perms}>
      {children}
    </AppShell>
  );
}
