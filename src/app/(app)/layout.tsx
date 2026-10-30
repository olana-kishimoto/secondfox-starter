import { getUser } from "@/lib/supabase/server";
import { AppShell } from "./AppShell";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await getUser();
  return <AppShell email={me?.email ?? undefined}>{children}</AppShell>;
}
