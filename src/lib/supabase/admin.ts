import { createClient } from "@supabase/supabase-js";

// service_role（RLS を越える鍵）。サーバー専用で、ページや Server Action の通常の読み書きには使わない。
// 使ってよいのは、呼び出し側で「その操作をしてよい人か」を確かめたあとの特権操作だけ（例：管理者による利用者の作成）。
// ブラウザ・ログス・画面・DB に鍵や、鍵で得た秘密（仮パスワードなど）を残さないこと。
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
