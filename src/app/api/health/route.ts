import { NextResponse } from "next/server";

// Denの死活監視の口。{ ok: true } だけ返す（業務データは出さない）ので公開して安全。
// 重要：アプリに入口の合言葉ゲート／ログイン確認を入れたら、/api/health は両方から必ず除外すること。
// 片方だけの除外だと未ログインの監視が 302/307 でログインへ飛ばされ、常に異常として記録される。
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true });
}
