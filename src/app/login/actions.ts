"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 内部パスだけ許可（「//evil.com」「/\evil.com」を弾く）。
function safeNext(v: string): string {
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}

const FAILED = "メールアドレスまたはパスワードが違います";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? "/"));
  const back = (msg: string) => redirect(`/login?error=${encodeURIComponent(msg)}${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`);

  if (!email || !password) back(FAILED);
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    await new Promise((r) => setTimeout(r, 600)); // 総当たりを遅くする
    back(FAILED); // 理由（メールが無い／パスワード違い）は区別して出さない
  }
  revalidatePath("/", "layout");
  redirect(next);
}

export async function logout() {
  const sb = await createClient();
  await sb.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
