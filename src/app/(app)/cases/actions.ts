"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { toUserMessage } from "@/lib/errors/db-error";
import { nullableString, parseNumber, validateDateInput } from "@/lib/format";
import { CASE_STATUS } from "@/lib/labels";
import type { FormState } from "@/lib/form-state";
import type { CaseValues } from "./CaseForm";

type Row = { title: string; customer_id: string | null; status: string; amount: number; due_date: string | null; memo: string };

type ParseAllResult =
  | { ok: true; row: Row; values: CaseValues }
  | { ok: false; fieldErrors: Partial<Record<keyof CaseValues, string>>; values: CaseValues };

function parseAll(formData: FormData): ParseAllResult {
  const title = String(formData.get("title") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");
  const amount = Math.round(parseNumber(formData.get("amount"), 0));
  const dueRaw = nullableString(formData.get("due_date"));
  const due = dueRaw ? validateDateInput(dueRaw) : null;
  const memo = String(formData.get("memo") ?? "").trim().slice(0, 1000);
  const customer_id = nullableString(formData.get("customer_id")) ?? "";

  const values: CaseValues = { title, customer_id, status, amount, due_date: dueRaw ?? "", memo };

  const fieldErrors: Partial<Record<keyof CaseValues, string>> = {};
  if (!title) fieldErrors.title = "件名を入力してください";
  else if (title.length > 100) fieldErrors.title = "件名は100文字以内にしてください";
  if (!CASE_STATUS[status]) fieldErrors.status = "状態が正しくありません";
  if (amount < 0 || amount > 2_000_000_000) fieldErrors.amount = "金額は0以上で入力してください";
  if (dueRaw && !due) fieldErrors.due_date = "期限は 2020〜2099 年の正しい日付で入力してください";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors, values };
  return { ok: true, row: { title, customer_id: nullableString(formData.get("customer_id")), status, amount, due_date: due, memo }, values };
}

export async function createCase(
  _prev: FormState<CaseValues>,
  formData: FormData,
): Promise<FormState<CaseValues>> {
  const { perms } = await getMyPerms();
  if (!can(perms, "cases", "edit")) redirect("/");
  const p = parseAll(formData);
  if (!p.ok) return { ok: false, fieldErrors: p.fieldErrors, values: p.values };
  const sb = await createClient();
  const { data, error } = await sb.from("cases").insert(p.row).select("case_no").single();
  if (error) return { ok: false, formError: toUserMessage(error), values: p.values };
  revalidatePath("/");
  redirect(`/?msg=案件 ${data.case_no} を登録しました`);
}

export async function updateCase(
  id: string,
  _prev: FormState<CaseValues>,
  formData: FormData,
): Promise<FormState<CaseValues>> {
  const { perms } = await getMyPerms();
  if (!can(perms, "cases", "edit")) redirect(`/cases/${id}?error=権限がありません`);
  const p = parseAll(formData);
  if (!p.ok) return { ok: false, fieldErrors: p.fieldErrors, values: p.values };
  const expected = nullableString(formData.get("expected_updated_at"));
  const sb = await createClient();
  let query = sb
    .from("cases")
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
  revalidatePath("/");
  redirect(`/?msg=案件を更新しました`);
}

// 状態だけを変える（一覧から1操作で済む「完了にする」など）。
export async function setCaseStatus(id: string, status: string) {
  const { perms } = await getMyPerms();
  if (!can(perms, "cases", "edit")) redirect(`/cases/${id}?error=権限がありません`);
  if (!CASE_STATUS[status]) redirect(`/cases/${id}?error=状態が正しくありません`);
  const sb = await createClient();
  const { data, error } = await sb
    .from("cases")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) redirect(`/cases/${id}?error=${toUserMessage(error)}`);
  if (!data || data.length === 0) redirect(`/cases/${id}?error=案件が見つかりません`);
  revalidatePath("/");
  redirect(`/?msg=状態を「${CASE_STATUS[status].label}」にしました`);
}

export async function deleteCase(id: string) {
  const { perms } = await getMyPerms();
  if (!can(perms, "cases", "manage")) redirect(`/cases/${id}?error=権限がありません`);
  const sb = await createClient();
  const { data, error } = await sb.from("cases").delete().eq("id", id).select("id");
  if (error) redirect(`/cases/${id}?error=${toUserMessage(error)}`);
  if (!data || data.length === 0) redirect(`/cases/${id}?error=案件が見つかりません`);
  revalidatePath("/");
  redirect(`/?msg=案件を削除しました`);
}
