"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { redirect } from "@/lib/redirect";
import { toUserMessage } from "@/lib/errors/db-error";

export async function createRole(formData: FormData) {
  const { perms } = await getMyPerms();
  if (!can(perms, "roles", "manage")) redirect("/settings/roles?error=権限がありません");

  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/settings/roles?error=役割名を入力してください");
  if (name.length > 50) redirect("/settings/roles?error=役割名は50文字以内にしてください");

  const sb = await createClient();
  const { data: role, error } = await sb.from("roles").insert({ name, is_system: false }).select("id").single();
  if (error) {
    const msg = error.code === "23505"
      ? "その名前は既に使われています。別の名前にしてください"
      : toUserMessage(error);
    redirect(`/settings/roles?error=${msg}`);
  }
  if (!role) redirect("/settings/roles?error=作成できませんでした。もう一度お試しください");

  const { data: features } = await sb.from("features").select("key");
  if (features) {
    await sb.from("role_permissions").insert(
      features.map((f) => ({ role_id: role.id, feature_key: f.key, level: "none" }))
    );
  }

  revalidatePath("/settings/roles");
  redirect(`/settings/roles?role=${role.id}&msg=役割を作成しました`);
}

export async function updateRoleName(formData: FormData) {
  const { perms } = await getMyPerms();
  if (!can(perms, "roles", "manage")) redirect("/settings/roles?error=権限がありません");

  const roleId = String(formData.get("role_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!roleId || !name) redirect("/settings/roles?error=パラメータが不正です");

  const sb = await createClient();
  const { data: role } = await sb.from("roles").select("is_system").eq("id", roleId).single();
  if (role?.is_system) redirect(`/settings/roles?role=${roleId}&error=システム役割の名前は変更できません`);

  const { error } = await sb.from("roles").update({ name }).eq("id", roleId);
  if (error) {
    const msg = error.code === "23505"
      ? "その名前は既に使われています。別の名前にしてください"
      : toUserMessage(error);
    redirect(`/settings/roles?role=${roleId}&error=${msg}`);
  }

  revalidatePath("/settings/roles");
  redirect(`/settings/roles?role=${roleId}&msg=役割名を変更しました`);
}

export async function deleteRole(formData: FormData) {
  const { perms } = await getMyPerms();
  if (!can(perms, "roles", "manage")) redirect("/settings/roles?error=権限がありません");

  const roleId = String(formData.get("role_id") ?? "");
  if (!roleId) redirect("/settings/roles?error=パラメータが不正です");

  const sb = await createClient();
  const { data: role } = await sb.from("roles").select("is_system").eq("id", roleId).single();
  if (role?.is_system) redirect("/settings/roles?error=システム役割は削除できません");

  const { count } = await sb.from("profiles").select("*", { count: "exact", head: true }).eq("role_id", roleId);
  if ((count ?? 0) > 0) redirect("/settings/roles?error=この役割のユーザーがいるため削除できません。先に役割を変えてください");

  const { error } = await sb.from("roles").delete().eq("id", roleId);
  if (error) redirect(`/settings/roles?error=${toUserMessage(error)}`);

  revalidatePath("/settings/roles");
  redirect("/settings/roles?msg=役割を削除しました");
}

export async function savePermissions(formData: FormData) {
  const { perms } = await getMyPerms();
  if (!can(perms, "roles", "manage")) redirect("/settings/roles?error=権限がありません");

  const roleId = String(formData.get("role_id") ?? "");
  if (!roleId) redirect("/settings/roles?error=パラメータが不正です");

  const sb = await createClient();
  const { data: role } = await sb.from("roles").select("is_system").eq("id", roleId).single();
  if (role?.is_system) redirect(`/settings/roles?role=${roleId}&error=システム役割の権限は変更できません`);

  const { data: features } = await sb.from("features").select("key");
  if (!features) redirect(`/settings/roles?role=${roleId}&error=保存に失敗しました`);

  const VALID_LEVELS = ["none", "view", "edit", "manage"];
  const upserts = features.map((f) => {
    const level = String(formData.get(`level_${f.key}`) ?? "none");
    return { role_id: roleId, feature_key: f.key, level: VALID_LEVELS.includes(level) ? level : "none" };
  });

  const { error } = await sb.from("role_permissions").upsert(upserts);
  if (error) redirect(`/settings/roles?role=${roleId}&error=${toUserMessage(error)}`);

  revalidatePath("/settings/roles");
  redirect(`/settings/roles?role=${roleId}&msg=権限を保存しました`);
}
