"use server";

import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import { passwordProblem } from "@/lib/password";

// 自分のパスワードの変更。現在のパスワードを確かめてから、新しいものに替える。
export async function changePassword(formData: FormData) {
  const me = await getUser();
  if (!me?.email) redirect("/login");
  const current = String(formData.get("current") ?? "");
  const pw = String(formData.get("password") ?? "");
  const pw2 = String(formData.get("password2") ?? "");
  const back = (e: string) => redirect(`/account?error=${encodeURIComponent(e)}`);

  const problem = passwordProblem(pw, me.email);
  if (problem) back(problem);
  if (pw !== pw2) back("確認用のパスワードが一致しません。");
  if (pw === current) back("現在と同じパスワードには変更できません。");

  const sb = await createClient();
  const re = await sb.auth.signInWithPassword({ email: me.email, password: current });
  if (re.error) {
    await new Promise((r) => setTimeout(r, 600));
    back("現在のパスワードが違います。");
  }
  const { error } = await sb.auth.updateUser({ password: pw });
  if (error) back(error.code === "weak_password" ? "このパスワードは使えません（漏洩が確認されているか、弱すぎます）。" : "変更できませんでした。時間をおいてもう一度お試しください。");
  redirect("/account?msg=" + encodeURIComponent("パスワードを変更しました"));
}
