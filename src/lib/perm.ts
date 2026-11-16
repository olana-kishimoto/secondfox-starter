import { cache } from "react";
import { createClient, getUser } from "@/lib/supabase/server";

export type Level = "none" | "view" | "edit" | "manage";
export type Perms = Readonly<Record<string, Level>>;

const ORDER: Level[] = ["none", "view", "edit", "manage"];

export function can(perms: Perms, feature: string, min: Level = "view"): boolean {
  const level = (perms[feature] ?? "none") as Level;
  return ORDER.indexOf(level) >= ORDER.indexOf(min);
}

export const getMyPerms = cache(async (): Promise<Perms> => {
  const user = await getUser();
  if (!user) return {};
  const sb = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (sb as any).rpc("my_perms");
  if (!data) return {};
  return data as Perms;
});
