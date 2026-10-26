import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

// リクエストごとのSupabaseクライアント（公開鍵・RLSの範囲内で読む）。
// 秘密鍵（service_role）はこのファイルでは使わない。NEXT_PUBLIC_ の2つだけで動く。
export function supabaseServer() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(items: { name: string; value: string; options: CookieOptions }[]) {
          try {
            items.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Server Component から呼ばれた場合は書き込み不可。読み取りには影響しない。
          }
        },
      },
    }
  );
}
