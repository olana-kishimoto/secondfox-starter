"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { toUserMessage } from "@/lib/errors/db-error";
import { parseNumber } from "@/lib/format";
import type { FormState } from "@/lib/form-state";
import type { ProductValues } from "./ProductForm";

type Row = { code: string; name: string; unit_price: number };

type ParseAllResult =
  | { ok: true; row: Row; values: ProductValues }
  | { ok: false; fieldErrors: Partial<Record<keyof ProductValues, string>>; values: ProductValues };

function parseAll(formData: FormData): ParseAllResult {
  const code = String(formData.get("code") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const unit_price = parseNumber(formData.get("unit_price"), -1);

  const values: ProductValues = { code, name, unit_price: String(unit_price) };
  const fieldErrors: Partial<Record<keyof ProductValues, string>> = {};

  if (!code) fieldErrors.code = "商品コードを入力してください";
  else if (code.length > 50) fieldErrors.code = "商品コードは50文字以内にしてください";
  if (!name) fieldErrors.name = "商品名を入力してください";
  else if (name.length > 100) fieldErrors.name = "商品名は100文字以内にしてください";
  if (unit_price < 0) fieldErrors.unit_price = "単価は0以上の整数を入力してください";

  if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors, values };
  return { ok: true, row: { code, name, unit_price }, values };
}

export async function createProduct(
  _prev: FormState<ProductValues>,
  formData: FormData,
): Promise<FormState<ProductValues>> {
  const { perms } = await getMyPerms();
  if (!can(perms, "products", "edit")) redirect("/products");
  const p = parseAll(formData);
  if (!p.ok) return { ok: false, fieldErrors: p.fieldErrors, values: p.values };
  const sb = await createClient();
  const { error } = await sb.from("products").insert(p.row);
  if (error) {
    const msg = error.code === "23505"
      ? "そのコードは既に使われています。別のコードにしてください"
      : toUserMessage(error);
    return { ok: false, formError: msg, values: p.values };
  }
  revalidatePath("/products");
  redirect("/products?msg=商品を登録しました");
}

export async function updateProduct(
  id: string,
  _prev: FormState<ProductValues>,
  formData: FormData,
): Promise<FormState<ProductValues>> {
  const { perms } = await getMyPerms();
  if (!can(perms, "products", "edit")) redirect(`/products/${id}?error=権限がありません`);
  const p = parseAll(formData);
  if (!p.ok) return { ok: false, fieldErrors: p.fieldErrors, values: p.values };
  const expected = String(formData.get("expected_updated_at") ?? "").trim() || null;
  const sb = await createClient();
  let query = sb
    .from("products")
    .update({ ...p.row, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (expected) query = (query as typeof query).eq("updated_at", expected);
  const { data, error } = await query.select("id");
  if (error) {
    const msg = error.code === "23505"
      ? "そのコードは既に使われています。別のコードにしてください"
      : toUserMessage(error);
    return { ok: false, formError: msg, values: p.values };
  }
  if (!data || data.length === 0) {
    return {
      ok: false,
      formError: expected
        ? "他の端末で変更が行われました。ページを再読み込みして最新の内容を確認してください。"
        : "更新できませんでした。もう一度お試しください。",
      values: p.values,
    };
  }
  revalidatePath("/products");
  redirect("/products?msg=商品を更新しました");
}

export async function deleteProduct(id: string) {
  const { perms } = await getMyPerms();
  if (!can(perms, "products", "manage")) redirect(`/products/${id}?error=権限がありません`);
  const sb = await createClient();
  const { data, error } = await sb.from("products").delete().eq("id", id).select("id");
  if (error) {
    const msg = error.code === "23503"
      ? "この商品は受注明細で使われているため削除できません。先に明細を変更してください。"
      : toUserMessage(error);
    redirect(`/products/${id}?error=${msg}`);
  }
  if (!data || data.length === 0) redirect(`/products/${id}?error=対象が見つかりません`);
  revalidatePath("/products");
  redirect("/products?msg=商品を削除しました");
}
