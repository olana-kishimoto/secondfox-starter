import { cache } from "react";
import { createClient, getUser } from "@/lib/supabase/server";
import type { Perms } from "@/lib/can";
export type { Level, Perms } from "@/lib/can";
export { can } from "@/lib/can";

export type PermsResult = { perms: Perms; fetchFailed: boolean };

export const getMyPerms = cache(async (): Promise<PermsResult> => {
  const user = await getUser();
  if (!user) return { perms: {}, fetchFailed: false };
  const sb = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("my_perms");
  if (error) {
    console.error("[perm] my_perms RPC error:", error.code, error.message);
    return { perms: {}, fetchFailed: true };
  }
  if (!data) return { perms: {}, fetchFailed: false };
  return { perms: data as Perms, fetchFailed: false };
});
