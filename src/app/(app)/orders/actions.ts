"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { toUserMessage } from "@/lib/errors/db-error";
import { nullableString, parseNumber, validateDateInput } from "@/lib/format";
import { ORDER_STATUS } from "@/lib/labels";
import type { FormState } from "@/lib/form-state";
import type { OrderValues, OrderItemInput } from "./OrderForm";

// save_order RPC の返り値
type SaveOrderResult = {
  result: "ok" | "conflict" | "not_found";
  order_id?: string;
  order_no?: string;
};

function parseItems(raw: string): { ok: true; items: { product_id: string | null; name: string; qty: number; unit_price: number }[] } | { ok: false; error: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(raw || "[]"); } catch { return { ok: false, error: "明細データが不正です" }; }
  if (!Array.isArray(parsed)) return { ok: false, error: "明細データが不正です" };
  if (parsed.length === 0) return { ok: false, error: "明細を1行以上入力してください" };
  const items: { product_id: string | null; name: string; qty: number; unit_price: number }[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const it = parsed[i] as OrderItemInput;
    const name = String(it?.name ?? "").trim();
    if (!name) return { ok: false, error: `明細 ${i + 1} 行目：品名を入力してください` };
    const qty = Math.round(Number(it?.qty ?? 0));
    if (!qty || qty < 1) return { ok: false, error: `明細 ${i + 1} 行目：数量は1以上の整数で入力してください` };
    const unit_price = Math.round(Number(it?.unit_price ?? 0));
    if (unit_price < 0) return { ok: false, error: `明細 ${i + 1} 行目：単価は0以上で入力してください` };
    const product_id = nullableString(it?.product_id ?? null);
    items.push({ product_id, name, qty, unit_price });
  }
  return { ok: true, items };
}

type ParseResult =
  | { ok: true; header: { customer_id: string | null; order_date: string; status: string; memo: string }; items: { product_id: string | null; name: string; qty: number; unit_price: number }[]; values: OrderValues }
  | { ok: false; fieldErrors: Partial<Record<keyof OrderValues, string>>; values: OrderValues };

function parseAll(formData: FormData): ParseResult {
  const customer_id = nullableString(formData.get("customer_id"));
  const orderDateRaw = nullableString(formData.get("order_date"));
  const order_date = orderDateRaw ? (validateDateInput(orderDateRaw) ?? "") : "";
  const status = String(formData.get("status") ?? "draft");
  const memo = String(formData.get("memo") ?? "").trim().slice(0, 1000);
  const itemsRaw = String(formData.get("items") ?? "[]");

  const values: OrderValues = {
    customer_id: customer_id ?? "",
    order_date: orderDateRaw ?? "",
    status,
    memo,
    items: itemsRaw,
  };

  const fieldErrors: Partial<Record<keyof OrderValues, string>> = {};
  if (!order_date) fieldErrors.order_date = "受注日は 2020〜2099 年の正しい日付で入力してください";
  if (!ORDER_STATUS[status]) fieldErrors.status = "状態が正しくありません";

  const itemParse = parseItems(itemsRaw);
  if (!itemParse.ok) fieldErrors.items = itemParse.error;

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors, values };
  return {
    ok: true,
    header: { customer_id, order_date, status, memo },
    items: (itemParse as { ok: true; items: { product_id: string | null; name: string; qty: number; unit_price: number }[] }).items,
    values,
  };
}

export async function createOrder(
  _prev: FormState<OrderValues>,
  formData: FormData,
): Promise<FormState<OrderValues>> {
  const { perms } = await getMyPerms();
  if (!can(perms, "orders", "edit")) redirect("/orders");
  const p = parseAll(formData);
  if (!p.ok) return { ok: false, fieldErrors: p.fieldErrors, values: p.values };
  const sb = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("save_order", {
    p_id: null,
    p_customer_id: p.header.customer_id,
    p_order_date: p.header.order_date,
    p_status: p.header.status,
    p_memo: p.header.memo,
    p_items: p.items,
    p_expected_updated_at: null,
  });
  if (error) return { ok: false, formError: toUserMessage(error), values: p.values };
  const res = data as SaveOrderResult;
  if (res.result !== "ok") return { ok: false, formError: "登録できませんでした。もう一度お試しください。", values: p.values };
  revalidatePath("/orders");
  redirect(`/orders?msg=受注 ${res.order_no} を登録しました`);
}

export async function updateOrder(
  id: string,
  _prev: FormState<OrderValues>,
  formData: FormData,
): Promise<FormState<OrderValues>> {
  const { perms } = await getMyPerms();
  if (!can(perms, "orders", "edit")) redirect(`/orders/${id}?error=権限がありません`);
  const p = parseAll(formData);
  if (!p.ok) return { ok: false, fieldErrors: p.fieldErrors, values: p.values };
  const expected = nullableString(formData.get("expected_updated_at"));
  const sb = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb as any).rpc("save_order", {
    p_id: id,
    p_customer_id: p.header.customer_id,
    p_order_date: p.header.order_date,
    p_status: p.header.status,
    p_memo: p.header.memo,
    p_items: p.items,
    p_expected_updated_at: expected ?? null,
  });
  if (error) return { ok: false, formError: toUserMessage(error), values: p.values };
  const res = data as SaveOrderResult;
  if (res.result === "conflict") {
    return {
      ok: false,
      formError: "他の端末で変更が行われました。ページを再読み込みして最新の内容を確認してください。",
      values: p.values,
    };
  }
  if (res.result !== "ok") return { ok: false, formError: "更新できませんでした。もう一度お試しください。", values: p.values };
  revalidatePath("/orders");
  redirect(`/orders?msg=受注を更新しました`);
}

export async function setOrderStatus(id: string, status: string) {
  const { perms } = await getMyPerms();
  if (!can(perms, "orders", "edit")) redirect(`/orders/${id}?error=権限がありません`);
  if (!ORDER_STATUS[status]) redirect(`/orders/${id}?error=状態が正しくありません`);
  const sb = await createClient();
  const { data, error } = await sb
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");
  if (error) redirect(`/orders/${id}?error=${toUserMessage(error)}`);
  if (!data || data.length === 0) redirect(`/orders/${id}?error=受注が見つかりません`);
  revalidatePath("/orders");
  redirect(`/orders?msg=状態を「${ORDER_STATUS[status].label}」にしました`);
}

export async function deleteOrder(id: string) {
  const { perms } = await getMyPerms();
  if (!can(perms, "orders", "manage")) redirect(`/orders/${id}?error=権限がありません`);
  const sb = await createClient();
  const { data, error } = await sb.from("orders").delete().eq("id", id).select("id");
  if (error) redirect(`/orders/${id}?error=${toUserMessage(error)}`);
  if (!data || data.length === 0) redirect(`/orders/${id}?error=受注が見つかりません`);
  revalidatePath("/orders");
  redirect(`/orders?msg=受注を削除しました`);
}
