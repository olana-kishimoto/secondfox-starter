"use server";

import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/roles";
import { ADMIN_ROLE, roleKeyProblem } from "@/lib/roles-core";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const back = (kind: "error" | "msg", t: string): never => redirect(`/admin/roles?${kind}=${encodeURIComponent(t)}`);

// 利用者の役割を決める（空は「役割なし」）。管理者だけ。書き込みは ログイン中の管理者として行うので、RLS も管理者だけを通す。
export async function setUserRole(formData: FormData) {
  await requireAdmin();
  const me = await getUser();
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!UUID.test(userId)) back("error", "利用者が分かりません。");
  if (me && userId === me.id && role !== ADMIN_ROLE) back("error", "自分自身の管理者の役割は外せません。ほかの管理者に頼んでください。");
  const sb = await createClient();
  if (!role) {
    const { error } = await sb.from("profiles").delete().eq("user_id", userId);
    if (error) back("error", "変更できませんでした。");
    back("msg", "役割を外しました");
  }
  const { data: r } = await sb.from("roles").select("key").eq("key", role).maybeSingle();
  if (!r) back("error", "その役割はありません。");
  const { error } = await sb.from("profiles").upsert({ user_id: userId, role, updated_at: new Date().toISOString(), updated_by: me?.id ?? null }, { onConflict: "user_id" });
  if (error) back("error", "変更できませんでした。");
  back("msg", "役割を変更しました");
}

// 役割を足す（各システムが決める役割。例：sales／営業）。管理者だけ。
export async function addRole(formData: FormData) {
  await requireAdmin();
  const key = String(formData.get("key") ?? "").trim();
  const label = String(formData.get("label") ?? "").trim();
  const p = roleKeyProblem(key);
  if (p) back("error", p);
  if (key === ADMIN_ROLE) back("error", "admin は予約の役割です。");
  if (!label || label.length > 40) back("error", "役割の名前は1〜40文字で入れてください。");
  const sb = await createClient();
  const { error } = await sb.from("roles").insert({ key, label, sort: 100 });
  if (error) back("error", error.code === "23505" ? "その役割はすでにあります。" : "追加できませんでした。");
  back("msg", "役割を追加しました");
}
