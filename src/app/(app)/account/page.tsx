import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { FlashMessage } from "@/components/ui/FlashMessage";
import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { getUser } from "@/lib/supabase/server";
import { PASSWORD_MIN } from "@/lib/password";
import { APP_NAME } from "@/lib/app-info";
import { changePassword } from "./actions";

export const metadata: Metadata = { title: `アカウント — ${APP_NAME}` };
export const dynamic = "force-dynamic";

type SP = Promise<{ error?: string; msg?: string }>;

export default async function AccountPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const me = await getUser();

  return (
    <main className="mx-auto max-w-[520px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader eyebrow="Account" title="アカウント" description="ログイン中のアカウントのパスワードを変更できます。" />
      <FlashMessage msg={sp.msg} error={sp.error} />

      <div className="mb-3 rounded-md border border-line bg-surface px-4 py-3 text-[12px] text-muted">
        ログイン中：<span className="text-text">{me?.email}</span>
      </div>

      <form action={changePassword} className="rounded-md border border-line bg-surface p-5">
        <Field label="現在のパスワード" htmlFor="current" required>
          <Input id="current" name="current" type="password" autoComplete="current-password" required />
        </Field>
        <Field label="新しいパスワード" htmlFor="password" required hint={`${PASSWORD_MIN}文字以上。よくあるパスワードや、メールアドレスを含むものは使えません。`}>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} required />
        </Field>
        <Field label="新しいパスワード（確認）" htmlFor="password2" required>
          <Input id="password2" name="password2" type="password" autoComplete="new-password" minLength={PASSWORD_MIN} required />
        </Field>
        <div className="mt-2 border-t border-line pt-4">
          <SubmitButton pendingLabel="変更中…">パスワードを変更</SubmitButton>
        </div>
      </form>
    </main>
  );
}
