import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// リクエスト単位の Supabase クライアント。ログイン中の利用者として動く（公開鍵・RLS の範囲内）。
// ページと Server Action の読み書きは、すべてこれを使う。service_role は使わない（admin.ts を参照）。
export const createClient = cache(async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component から呼ばれた場合は書き込み不可（middleware がセッションを更新する）
          }
        },
      },
    },
  );
});

// ログイン中の利用者（いなければ null）。Supabase に問い合わせて確かめる。同じリクエスト内では1回だけ。
export const getUser = cache(async (): Promise<{ id: string; email: string | null } | null> => {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
});
