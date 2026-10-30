"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export type SearchTemplate = {
  id: number;
  name: string;
  params: string;
};

// 一覧の検索条件の保存・取得・削除。ログインを足したら user_id 列を足して利用者ごとに分ける。
export async function loadSearchTemplates(screenKey: string): Promise<SearchTemplate[]> {
  const sb = createAdminClient();
  if (!sb) return [];
  const { data } = await sb
    .from("search_templates")
    .select("id, name, params")
    .eq("screen_key", screenKey)
    .order("created_at");
  return (data ?? []) as SearchTemplate[];
}

// 同名の条件は上書きする。
export async function saveSearchTemplate(
  screenKey: string,
  name: string,
  params: string,
): Promise<{ error?: string }> {
  if (!name.trim()) return { error: "テンプレート名を入力してください" };
  if (name.length > 50) return { error: "テンプレート名は50文字以内にしてください" };
  const sb = createAdminClient();
  if (!sb) return { error: "データベースに接続できません（環境変数が未設定です）" };
  const { error } = await sb
    .from("search_templates")
    .upsert({ screen_key: screenKey, name: name.trim(), params }, { onConflict: "screen_key,name" });
  if (error) return { error: "保存に失敗しました" };
  revalidatePath("/");
  return {};
}

export async function deleteSearchTemplate(id: number): Promise<{ error?: string }> {
  const sb = createAdminClient();
  if (!sb) return { error: "データベースに接続できません（環境変数が未設定です）" };
  const { error } = await sb.from("search_templates").delete().eq("id", id);
  if (error) return { error: "削除に失敗しました" };
  revalidatePath("/");
  return {};
}
