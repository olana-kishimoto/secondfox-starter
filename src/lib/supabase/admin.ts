import { createClient } from "@supabase/supabase-js";

// サーバー専用（service_role）。RLS を越えて読み書きするので、必ずサーバーの処理（ページ・Server Action）からだけ使う。
// ログインを足したら、画面側は server.ts の createClient()（公開鍵・RLS の範囲内）へ切り替える。
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
