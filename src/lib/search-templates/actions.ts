"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SearchTemplate = {
  id: number;
  name: string;
  params: string;
};

// 一覧の検索条件の保存・取得・削除。ログイン中の利用者ごと（RLS：user_id = auth.uid()）。
export async function loadSearchTemplates(screenKey: string): Promise<SearchTemplate[]> {
  const sb = await createClient();
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
  const sb = await createClient();
  const { error } = await sb
    .from("search_templates")
    .upsert({ screen_key: screenKey, name: name.trim(), params }, { onConflict: "user_id,screen_key,name" });
  if (error) return { error: "保存に失敗しました" };
  revalidatePath("/");
  return {};
}

export async function deleteSearchTemplate(id: number): Promise<{ error?: string }> {
  const sb = await createClient();
  const { error } = await sb.from("search_templates").delete().eq("id", id);
  if (error) return { error: "削除に失敗しました" };
  revalidatePath("/");
  return {};
}
