import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getUser } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/app-info";
import { login } from "./actions";

export const metadata: Metadata = {
  title: `ログイン — ${APP_NAME}`,
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string; next?: string }>;

const inputCls =
  "w-full rounded border border-line bg-surface px-3 py-[7px] text-[13px] text-text focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-soft";
const labelCls = "mb-2 block text-[9.5px] uppercase tracking-[0.2em] text-muted";

// ログイン。自己登録・メール認証は無い（利用者は管理者が Supabase で作る）。
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { error, next } = await searchParams;
  const safe = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
  if (await getUser()) redirect(safe); // ログイン済みなら本体へ

  return (
    <main className="flex min-h-screen items-center justify-center bg-base px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-8 text-center">
          <div className="mb-2 text-[10px] uppercase tracking-[0.38em] text-accent">{APP_NAME}</div>
          <h1 className="text-[16px] font-semibold tracking-[0.1em] text-text">ログイン</h1>
          <div className="mx-auto mt-3 h-[2px] w-[28px] bg-accent" />
        </div>

        <form action={login} className="rounded-md border border-line bg-surface px-8 py-8">
          <input type="hidden" name="next" value={safe} />

          <div className="mb-4">
            <label htmlFor="email" className={labelCls}>メールアドレス</label>
            <input id="email" name="email" type="email" autoComplete="email" required className={inputCls} />
          </div>

          <div className="mb-5">
            <label htmlFor="password" className={labelCls}>パスワード</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className={inputCls} />
          </div>

          {error && (
            <p className="mb-3 rounded border border-bad/30 bg-bad-bg px-3 py-2 text-[12px] text-bad">{error}</p>
          )}

          <SubmitButton pendingLabel="ログイン中…" className="mt-1 w-full py-[12px] text-[12px] tracking-[0.22em]">
            ログイン
          </SubmitButton>
        </form>
        <p className="mt-4 text-center text-[11px] text-muted">アカウントは管理者が作成します。登録はできません。</p>
      </div>
    </main>
  );
}
