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

type ItemRow = { order_id: string; product_id: string | null; name: string; qty: number; unit_price: number; line_no: number };

function parseItems(raw: string): { ok: true; rows: Omit<ItemRow, "order_id">[] } | { ok: false; error: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(raw || "[]"); } catch { return { ok: false, error: "明細データが不正です" }; }
  if (!Array.isArray(parsed)) return { ok: false, error: "明細データが不正です" };
  if (parsed.length === 0) return { ok: false, error: "明細を1行以上入力してください" };
  const rows: Omit<ItemRow, "order_id">[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const it = parsed[i] as OrderItemInput;
    const name = String(it?.name ?? "").trim();
    if (!name) return { ok: false, error: `明細 ${i + 1} 行目：品名を入力してください` };
    const qty = Math.round(Number(it?.qty ?? 0));
    if (!qty || qty < 1) return { ok: false, error: `明細 ${i + 1} 行目：数量は1以上の整数で入力してください` };
    const unit_price = Math.round(Number(it?.unit_price ?? 0));
    if (unit_price < 0) return { ok: false, error: `明細 ${i + 1} 行目：単価は0以上で入力してください` };
    const product_id = nullableString(it?.product_id ?? null);
    rows.push({ product_id, name, qty, unit_price, line_no: i + 1 });
  }
  return { ok: true, rows };
}

type ParseResult =
  | { ok: true; header: { customer_id: string | null; order_date: string; status: string; memo: string }; items: Omit<ItemRow, "order_id">[]; values: OrderValues }
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
    items: (itemParse as { ok: true; rows: Omit<ItemRow, "order_id">[] }).rows,
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
  const { data: order, error: orderError } = await sb
    .from("orders")
    .insert(p.header)
    .select("id, order_no")
    .single();
  if (orderError) return { ok: false, formError: toUserMessage(orderError), values: p.values };
  const itemRows = p.items.map((it) => ({ ...it, order_id: order.id }));
  const { error: itemError } = await sb.from("order_items").insert(itemRows);
  if (itemError) {
    await sb.from("orders").delete().eq("id", order.id);
    return { ok: false, formError: toUserMessage(itemError), values: p.values };
  }
  revalidatePath("/orders");
  redirect(`/orders?msg=受注 ${order.order_no} を登録しました`);
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
  let query = sb
    .from("orders")
    .update({ ...p.header, updated_at: new Date().toISOString() })
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
  // 明細を入れ替える（delete + re-insert）
  const { error: delError } = await sb.from("order_items").delete().eq("order_id", id);
  if (delError) return { ok: false, formError: toUserMessage(delError), values: p.values };
  const itemRows = p.items.map((it) => ({ ...it, order_id: id }));
  const { error: itemError } = await sb.from("order_items").insert(itemRows);
  if (itemError) return { ok: false, formError: toUserMessage(itemError), values: p.values };
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
