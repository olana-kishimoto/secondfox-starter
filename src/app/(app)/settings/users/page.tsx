import type { Metadata } from "next";
import { redirect } from "@/lib/redirect";
import { getMyPerms, can } from "@/lib/perm";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { APP_NAME } from "@/lib/app-info";
import { changeRole, deactivateUser, reactivateUser } from "./actions";
import { AddUserForm, ResetPasswordForm } from "./UserForms";

export const metadata: Metadata = { title: `ユーザー管理 — ${APP_NAME}` };
export const dynamic = "force-dynamic";

export default async function UsersPage({
  searchParams,
}: {
  searchParams?: Promise<{ msg?: string; error?: string }>;
}) {
  const perms = await getMyPerms();
  if (!can(perms, "users", "manage")) redirect("/");

  const sb = await createClient();
  const { data: profiles } = await sb
    .from("profiles")
    .select("user_id, email, active, role_id, roles(id, name, is_system)")
    .order("created_at");

  const { data: roles } = await sb
    .from("roles")
    .select("id, name, is_system")
    .order("created_at");

  const sp = await searchParams;
  const msg = sp?.msg;
  const err = sp?.error;

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader eyebrow="設定" title="ユーザー管理" description="利用者の追加・役割の変更・仮パスワードの発行ができます。" />

      {msg && <div className="notice ok mb-4"><p>{msg}</p></div>}
      {err && <div className="notice bad mb-4"><p>{err}</p></div>}

      {/* 利用者一覧 */}
      <section className="mb-10">
        <h2 className="text-[14px] font-semibold tracking-[0.06em] text-text mb-4">利用者一覧</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.14em] text-muted">
                <th className="pb-2 pr-4 font-medium">メール</th>
                <th className="pb-2 pr-4 font-medium">役割</th>
                <th className="pb-2 pr-4 font-medium">状態</th>
                <th className="pb-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {(profiles ?? []).map((p) => {
                const roleRaw = p.roles as { id: string; name: string; is_system: boolean }[] | null;
                const role = Array.isArray(roleRaw) ? (roleRaw[0] ?? null) : (roleRaw as unknown as { id: string; name: string; is_system: boolean } | null);
                return (
                  <tr key={p.user_id} className="border-b border-line/50">
                    <td className="py-3 pr-4 text-text">{p.email ?? "—"}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge label={role?.name ?? "—"} color={role?.is_system ? "accent" : "muted"} />
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge label={p.active ? "有効" : "無効"} color={p.active ? "ok" : "bad"} />
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2 items-start">
                        {/* 役割変更 */}
                        <form action={changeRole}>
                          <input type="hidden" name="user_id" value={p.user_id} />
                          <select name="role_id" defaultValue={role?.id ?? ""}
                            className="text-[12px] border border-line rounded px-2 py-1 bg-surface mr-1">
                            {(roles ?? []).map((r) => (
                              <option key={r.id} value={r.id}>{r.name}</option>
                            ))}
                          </select>
                          <button type="submit" className="secondary" style={{ fontSize: 12, padding: "4px 10px" }}>変更</button>
                        </form>
                        {/* 有効/無効化 */}
                        {p.active ? (
                          <form action={deactivateUser}>
                            <input type="hidden" name="user_id" value={p.user_id} />
                            <button type="submit" className="secondary" style={{ fontSize: 12, padding: "4px 10px" }}>無効化</button>
                          </form>
                        ) : (
                          <form action={reactivateUser}>
                            <input type="hidden" name="user_id" value={p.user_id} />
                            <button type="submit" className="secondary" style={{ fontSize: 12, padding: "4px 10px" }}>有効にする</button>
                          </form>
                        )}
                        {/* 仮パスワード再発行 */}
                        <ResetPasswordForm userId={p.user_id} email={p.email ?? ""} />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!(profiles ?? []).length && (
                <tr><td colSpan={4} className="py-8 text-muted text-center">利用者がまだいません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 利用者を追加 */}
      <section>
        <h2 className="text-[14px] font-semibold tracking-[0.06em] text-text mb-4">利用者を追加する</h2>
        <AddUserForm roles={(roles ?? []).map((r) => ({ id: r.id, name: r.name }))} />
      </section>
    </main>
  );
}
