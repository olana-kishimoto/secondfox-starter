import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { FlashMessage } from "@/components/ui/FlashMessage";
import { Field, Input, Select } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/roles";
import { APP_NAME } from "@/lib/app-info";
import { addRole, setUserRole } from "./actions";

export const metadata: Metadata = { title: `利用者と役割 — ${APP_NAME}` };
export const dynamic = "force-dynamic";

type SP = Promise<{ error?: string; msg?: string }>;

// 管理者だけの画面。利用者ごとに役割を決める。利用者そのものは、これまでどおり管理者が Supabase の Auth で作る（自己登録なし）。
export default async function RolesPage({ searchParams }: { searchParams: SP }) {
  await requireAdmin();
  const sp = await searchParams;
  const sb = await createClient();
  const [{ data: roles }, { data: profiles }] = await Promise.all([
    sb.from("roles").select("key,label").order("sort").order("key"),
    sb.from("profiles").select("user_id,role"),
  ]);
  const roleOf = new Map((profiles ?? []).map((p) => [p.user_id as string, p.role as string]));

  // 利用者の一覧（メールアドレス）は Auth の管理用の口から。管理者と確かめたあとの、読むだけの特権操作。
  const admin = createAdminClient();
  const list = admin ? await admin.auth.admin.listUsers({ page: 1, perPage: 200 }) : null;
  const users = list && !list.error ? list.data.users.map((u) => ({ id: u.id, email: u.email ?? "（メールなし）" })) : null;

  return (
    <main className="mx-auto max-w-[760px] px-4 py-6 md:px-8 md:py-8">
      <PageHeader eyebrow="Settings" title="利用者と役割" description="利用者ごとに役割を決めます。役割によって、見える画面とできる操作が変わります。" />
      <FlashMessage msg={sp.msg} error={sp.error} />

      <section className="mb-6 rounded-md border border-line bg-surface p-5">
        <h2 className="mb-3 text-[13px] font-bold text-text">利用者の役割</h2>
        {!users ? (
          <p className="text-[12px] text-muted">利用者の一覧を読み込めませんでした（サーバーの設定が足りないか、一時的なエラーです）。</p>
        ) : !users.length ? (
          <p className="text-[12px] text-muted">利用者がまだいません。</p>
        ) : (
          <ul className="divide-y divide-line">
            {users.map((u) => (
              <li key={u.id}>
                <form action={setUserRole} className="flex flex-col gap-2 py-3 md:flex-row md:items-center">
                  <input type="hidden" name="userId" value={u.id} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-text" title={u.email}>{u.email}</span>
                  <Select name="role" defaultValue={roleOf.get(u.id) ?? ""} aria-label={`${u.email} の役割`} className="md:w-[180px]">
                    <option value="">役割なし</option>
                    {(roles ?? []).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </Select>
                  <SubmitButton pendingLabel="保存中…">保存</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] leading-[1.6] text-muted">「役割なし」の利用者は、役割で守られた画面・データを見られません。管理者は、すべて見られます。</p>
      </section>

      <section className="rounded-md border border-line bg-surface p-5">
        <h2 className="mb-1 text-[13px] font-bold text-text">役割を足す</h2>
        <p className="mb-3 text-[11px] leading-[1.6] text-muted">いまある役割：{(roles ?? []).map((r) => r.label).join("、") || "—"}。業務に合わせた役割（例：営業・経理）を足せます。足した役割で何が見えるかは、システムごとに決めます。</p>
        <form action={addRole}>
          <Field label="役割のキー" htmlFor="key" required hint="英小文字で始まる2〜31文字（英小文字・数字・_）。例：sales"><Input id="key" name="key" required maxLength={31} /></Field>
          <Field label="役割の名前" htmlFor="label" required hint="画面に出る名前。例：営業"><Input id="label" name="label" required maxLength={40} /></Field>
          <SubmitButton pendingLabel="追加中…">役割を追加</SubmitButton>
        </form>
      </section>
    </main>
  );
}
