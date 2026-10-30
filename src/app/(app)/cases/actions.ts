"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import { toUserMessage } from "@/lib/errors/db-error";
import { nullableString, parseNumber, validateDateInput } from "@/lib/format";
import { CASE_STATUS } from "@/lib/labels";

type Parsed =
  | { ok: true; row: { title: string; customer_id: string | null; status: string; amount: number; due_date: string | null; memo: string } }
  | { ok: false; error: string };

// フォームの値を検証して行にする（入力の誤りは日本語で返す）。
function parse(formData: FormData): Parsed {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { ok: false, error: "件名を入力してください" };
  if (title.length > 100) return { ok: false, error: "件名は100文字以内にしてください" };
  const status = String(formData.get("status") ?? "draft");
  if (!CASE_STATUS[status]) return { ok: false, error: "状態が正しくありません" };
  const amount = Math.round(parseNumber(formData.get("amount"), 0));
  if (amount < 0 || amount > 2_000_000_000) return { ok: false, error: "金額は0以上で入力してください" };
  const dueRaw = nullableString(formData.get("due_date"));
  const due = dueRaw ? validateDateInput(dueRaw) : null;
  if (dueRaw && !due) return { ok: false, error: "期限は 2020〜2099 年の正しい日付で入力してください" };
  return {
    ok: true,
    row: {
      title,
      customer_id: nullableString(formData.get("customer_id")),
      status,
      amount,
      due_date: due,
      memo: String(formData.get("memo") ?? "").trim().slice(0, 1000),
    },
  };
}

export async function createCase(formData: FormData) {
  const p = parse(formData);
  if (!p.ok) redirect(`/cases/new?error=${p.error}`);
  const sb = await createClient();
  const { data, error } = await sb.from("cases").insert(p.row).select("case_no").single();
  if (error) redirect(`/cases/new?error=${toUserMessage(error)}`);
  revalidatePath("/");
  redirect(`/?msg=案件 ${data.case_no} を登録しました`);
}

export async function updateCase(id: string, formData: FormData) {
  const p = parse(formData);
  if (!p.ok) redirect(`/cases/${id}?error=${p.error}`);
  const sb = await createClient();
  const { error } = await sb.from("cases").update({ ...p.row, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`/cases/${id}?error=${toUserMessage(error)}`);
  revalidatePath("/");
  redirect(`/?msg=案件を更新しました`);
}

// 状態だけを変える（一覧から1操作で済む「完了にする」など）。
export async function setCaseStatus(id: string, status: string) {
  if (!CASE_STATUS[status]) redirect(`/cases/${id}?error=状態が正しくありません`);
  const sb = await createClient();
  const { error } = await sb.from("cases").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) redirect(`/cases/${id}?error=${toUserMessage(error)}`);
  revalidatePath("/");
  redirect(`/?msg=状態を「${CASE_STATUS[status].label}」にしました`);
}

export async function deleteCase(id: string) {
  const sb = await createClient();
  const { error } = await sb.from("cases").delete().eq("id", id);
  if (error) redirect(`/cases/${id}?error=${toUserMessage(error)}`);
  revalidatePath("/");
  redirect(`/?msg=案件を削除しました`);
}
