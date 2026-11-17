import { getUser } from "@/lib/supabase/server";
import { getMyPerms } from "@/lib/perm";
import type { Perms } from "@/lib/can";
import { AppShell } from "./AppShell";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await getUser();
  const { perms, fetchFailed } = me
    ? await getMyPerms()
    : { perms: {} as Perms, fetchFailed: false };
  return (
    <AppShell email={me?.email ?? undefined} perms={perms} permsFailed={fetchFailed}>
      {children}
    </AppShell>
  );
}
