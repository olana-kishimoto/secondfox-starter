import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { isAdminRole, roleAllows } from "@/lib/roles-core";

// ログイン中の利用者の役割（無ければ null＝役割なし）。サーバーで判定する（クライアントの申告は信じない）。
// 自分の行は RLS で読める。読めなかった・エラーのときも null（安全側＝何も許さない）。
export const currentRole = cache(async (): Promise<string | null> => {
  const me = await getUser();
  if (!me) return null;
  const sb = await createClient();
  const { data, error } = await sb.from("profiles").select("role").eq("user_id", me.id).maybeSingle();
  if (error) return null;   // 0003 が未適用のときもここ。従来の画面は影響を受けない
  return typeof data?.role === "string" ? data.role : null;
});

export const isAdmin = async () => isAdminRole(await currentRole());
export const hasRole = async (...keys: string[]) => roleAllows(await currentRole(), keys);

// ページ・Server Action の入口で使う。許されなければ、理由つきでホームへ戻す。
// 画面を隠すだけでなく、操作そのものをここで止める（守るデータは RLS でも閉じること）。
export async function requireRole(...keys: string[]) {
  if (!(await hasRole(...keys))) redirect("/?error=" + encodeURIComponent("この操作をする権限がありません。"));
}
export async function requireAdmin() { await requireRole(); }
