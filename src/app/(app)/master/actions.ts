"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { toUserMessage } from "@/lib/errors/db-error";
import { nullableString } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import type { CustomerValues } from "./CustomerForm";

// 簡易メールフォーマット検査（empty は OK）
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Row = { name: string; contact: string | null; email: string | null };

type ParseAllResult =
  | { ok: true; row: Row; values: CustomerValues }
  | { ok: false; fieldErrors: Partial<Record<keyof CustomerValues, string>>; values: CustomerValues };

function parseAll(formData: FormData): ParseAllResult {
  const name = String(formData.get("name") ?? "").trim();
  const contact = String(formData.get("contact") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();

  const values: CustomerValues = { name, contact, email };
  const fieldErrors: Partial<Record<keyof CustomerValues, string>> = {};

  if (!name) fieldErrors.name = "会社名を入力してください";
  else if (name.length > 100) fieldErrors.name = "会社名は100文字以内にしてください";
  if (email && !EMAIL_RE.test(email)) fieldErrors.email = "メールアドレスの形式が正しくありません";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors, values };
  return {
    ok: true,
    row: { name, contact: nullableString(contact), email: nullableString(email) },
    values,
  };
}

export async function createCustomer(
  _prev: FormState<CustomerValues>,
  formData: FormData,
): Promise<FormState<CustomerValues>> {
  const { perms } = await getMyPerms();
  if (!can(perms, "customers", "edit")) redirect("/master");
  const p = parseAll(formData);
  if (!p.ok) return { ok: false, fieldErrors: p.fieldErrors, values: p.values };
  const sb = await createClient();
  const { error } = await sb.from("customers").insert(p.row);
  if (error) return { ok: false, formError: toUserMessage(error), values: p.values };
  revalidatePath("/master");
  redirect("/master?msg=取引先を登録しました");
}

export async function updateCustomer(
  id: string,
  _prev: FormState<CustomerValues>,
  formData: FormData,
): Promise<FormState<CustomerValues>> {
  const { perms } = await getMyPerms();
  if (!can(perms, "customers", "edit")) redirect(`/master/${id}?error=権限がありません`);
  const p = parseAll(formData);
  if (!p.ok) return { ok: false, fieldErrors: p.fieldErrors, values: p.values };
  const expected = nullableString(formData.get("expected_updated_at"));
  const sb = await createClient();
  let query = sb
    .from("customers")
    .update({ ...p.row, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (expected) query = (query as typeof query).eq("updated_at", expected);
  const { data, error } = await query.select("id");
  if (error) return { ok: false, formError: toUserMessage(error), values: p.values };
  if (!data || data.length === 0) {
    return {
      ok: false,
      formError: expected
        ? "他の端末で変更が行われました。ページを再読み込みして最新の内容を確認してください。"
        : "更新できませんでした。もう一度お試しください。",
      values: p.values,
    };
  }
  revalidatePath("/master");
  redirect("/master?msg=取引先を更新しました");
}

export async function deleteCustomer(id: string) {
  const { perms } = await getMyPerms();
  if (!can(perms, "customers", "manage")) redirect(`/master/${id}?error=権限がありません`);
  const sb = await createClient();
  const { data, error } = await sb.from("customers").delete().eq("id", id).select("id");
  if (error) {
    // 23503 = FK violation（案件で使われている）
    const msg =
      error.code === "23503"
        ? "この顧客は案件で使われているため削除できません。先に案件の顧客を変更してください。"
        : toUserMessage(error);
    redirect(`/master/${id}?error=${msg}`);
  }
  if (!data || data.length === 0) redirect(`/master/${id}?error=対象が見つかりません`);
  revalidatePath("/master");
  redirect("/master?msg=取引先を削除しました");
}
