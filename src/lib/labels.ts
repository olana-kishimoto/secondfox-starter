// ステータスのラベルと色は、ここに集約する（画面ごとに書かない）。
export type BadgeColor = "accent" | "ok" | "warn" | "muted" | "bad";

export const CASE_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  draft:    { label: "下書き", color: "muted" },
  active:   { label: "進行中", color: "warn" },
  done:     { label: "完了",   color: "ok" },
  canceled: { label: "中止",   color: "bad" },
};

export function caseStatusLabel(s: string | null | undefined): { label: string; color: BadgeColor } {
  return CASE_STATUS[s ?? ""] ?? { label: s ?? "—", color: "muted" };
}

export const ORDER_STATUS: Record<string, { label: string; color: BadgeColor }> = {
  draft:     { label: "下書き", color: "muted" },
  confirmed: { label: "受注確定", color: "accent" },
  shipped:   { label: "出荷済み", color: "warn" },
  done:      { label: "完了",    color: "ok" },
  canceled:  { label: "中止",    color: "bad" },
};

export function orderStatusLabel(s: string | null | undefined): { label: string; color: BadgeColor } {
  return ORDER_STATUS[s ?? ""] ?? { label: s ?? "—", color: "muted" };
}
