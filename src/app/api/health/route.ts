import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 死活監視の口（Den の心拍が叩く）。DB に軽く1本届くことまで確かめ、届かなければ 503。
// 返すのは { ok } だけ（業務データ・エラーの中身は出さない）ので、公開して安全。
// 重要：アプリに入口の合言葉ゲート／ログイン確認を入れたら、/api/health は両方から必ず除外すること。
//   片方だけの除外だと未ログインの監視が 302/307 でログインへ飛ばされ、常に異常として記録される。
// DB の確認は、Auth の管理 API で利用者を1件だけ引く（テーブルに依存しない・サーバ専用の鍵・結果は捨てる）。
export const dynamic = "force-dynamic";

async function dbUp(): Promise<boolean> {
  const sb = createAdminClient();
  if (!sb) return false;
  try {
    const res = await Promise.race([
      sb.auth.admin.listUsers({ page: 1, perPage: 1 }),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000)),
    ]);
    return !res.error;
  } catch {
    return false;
  }
}

export async function GET() {
  const ok = await dbUp();
  return NextResponse.json({ ok }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
