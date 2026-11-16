"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { redirect } from "@/lib/redirect";

export type UserActionState = {
  ok: boolean;
  tmpPassword?: string;
  email?: string;
  error?: string;
};

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export async function addUser(_: UserActionState, formData: FormData): Promise<UserActionState> {
  const perms = await getMyPerms();
  if (!can(perms, "users", "manage")) return { ok: false, error: "権限がありません" };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleId = String(formData.get("role_id") ?? "").trim();
  if (!email || !email.includes("@")) return { ok: false, error: "メールアドレスが正しくありません" };
  if (!roleId) return { ok: false, error: "役割を選んでください" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "サーバー設定が不完全です（SUPABASE_SERVICE_ROLE_KEY）" };

  const tmpPassword = generateTempPassword();
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: tmpPassword,
    email_confirm: true,
  });
  if (error || !created.user) return { ok: false, error: error?.message ?? "作成に失敗しました" };

  const sb = await createClient();
  await sb.from("profiles").upsert({ user_id: created.user.id, role_id: roleId, email, active: true });

  revalidatePath("/settings/users");
  return { ok: true, tmpPassword, email };
}

export async function changeRole(formData: FormData) {
  const perms = await getMyPerms();
  if (!can(perms, "users", "manage")) redirect("/settings/users?error=権限がありません");

  const userId = String(formData.get("user_id") ?? "");
  const roleId = String(formData.get("role_id") ?? "");
  if (!userId || !roleId) redirect("/settings/users?error=パラメータが不正です");

  const sb = await createClient();

  const { data: profile } = await sb
    .from("profiles")
    .select("role_id, roles(is_system)")
    .eq("user_id", userId)
    .single();
  const roleData = profile?.roles as { is_system?: boolean } | null;
  if (roleData?.is_system && profile!.role_id !== roleId) {
    const { count } = await sb
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role_id", profile!.role_id)
      .eq("active", true);
    if ((count ?? 0) <= 1) redirect("/settings/users?error=最後の管理者の役割は変更できません");
  }

  const { error } = await sb.from("profiles").update({ role_id: roleId }).eq("user_id", userId);
  if (error) redirect("/settings/users?error=役割の変更に失敗しました");

  revalidatePath("/settings/users");
  redirect("/settings/users?msg=役割を変更しました");
}

export async function deactivateUser(formData: FormData) {
  const perms = await getMyPerms();
  if (!can(perms, "users", "manage")) redirect("/settings/users?error=権限がありません");

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) redirect("/settings/users?error=パラメータが不正です");

  const sb = await createClient();
  const { data: profile } = await sb
    .from("profiles")
    .select("role_id, roles(is_system)")
    .eq("user_id", userId)
    .single();

  const roleData = profile?.roles as { is_system?: boolean } | null;
  if (roleData?.is_system) {
    const { count } = await sb
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("role_id", profile!.role_id)
      .eq("active", true);
    if ((count ?? 0) <= 1) redirect("/settings/users?error=最後の管理者は無効化できません");
  }

  const admin = createAdminClient();
  if (admin) await admin.auth.admin.updateUserById(userId, { ban_duration: "876600h" });
  await sb.from("profiles").update({ active: false }).eq("user_id", userId);

  revalidatePath("/settings/users");
  redirect("/settings/users?msg=利用者を無効化しました");
}

export async function reactivateUser(formData: FormData) {
  const perms = await getMyPerms();
  if (!can(perms, "users", "manage")) redirect("/settings/users?error=権限がありません");

  const userId = String(formData.get("user_id") ?? "");
  if (!userId) redirect("/settings/users?error=パラメータが不正です");

  const admin = createAdminClient();
  if (admin) await admin.auth.admin.updateUserById(userId, { ban_duration: "none" });

  const sb = await createClient();
  await sb.from("profiles").update({ active: true }).eq("user_id", userId);

  revalidatePath("/settings/users");
  redirect("/settings/users?msg=利用者を有効にしました");
}

export async function resetPassword(_: UserActionState, formData: FormData): Promise<UserActionState> {
  const perms = await getMyPerms();
  if (!can(perms, "users", "manage")) return { ok: false, error: "権限がありません" };

  const userId = String(formData.get("user_id") ?? "");
  const email = String(formData.get("email") ?? "");
  if (!userId) return { ok: false, error: "パラメータが不正です" };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "サーバー設定が不完全です" };

  const tmpPassword = generateTempPassword();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: tmpPassword });
  if (error) return { ok: false, error: "パスワードの再発行に失敗しました" };

  return { ok: true, tmpPassword, email };
}
