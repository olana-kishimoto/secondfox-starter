import { cache } from "react";
import { createClient, getUser } from "@/lib/supabase/server";
import type { Perms } from "@/lib/can";
export type { Level, Perms } from "@/lib/can";
export { can } from "@/lib/can";

export const getMyPerms = cache(async (): Promise<Perms> => {
  const user = await getUser();
  if (!user) return {};
  const sb = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc("my_perms");
  if (!data) return {};
  return data as Perms;
});
