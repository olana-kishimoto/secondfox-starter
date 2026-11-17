// 権限判定のピュア関数。サーバ専用 API を持たないので Client Component からも import できる。
export type Level = "none" | "view" | "edit" | "manage";
export type Perms = Readonly<Record<string, Level>>;

const ORDER: Level[] = ["none", "view", "edit", "manage"];

export function can(perms: Perms, feature: string, min: Level = "view"): boolean {
  const level = (perms[feature] ?? "none") as Level;
  return ORDER.indexOf(level) >= ORDER.indexOf(min);
}
