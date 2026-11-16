import type { Metadata } from "next";
import { redirect } from "@/lib/redirect";
import { getMyPerms, can } from "@/lib/perm";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { APP_NAME } from "@/lib/app-info";
import { createRole, updateRoleName, deleteRole, savePermissions } from "./actions";

export const metadata: Metadata = { title: `権限マスタ — ${APP_NAME}` };
export const dynamic = "force-dynamic";

const LEVEL_LABELS: Record<string, string> = {
  none: "なし",
  view: "閲覧",
  edit: "編集",
  manage: "管理",
};
const LEVEL_COLORS: Record<string, string> = {
  none: "muted",
  view: "ok",
  edit: "warn",
  manage: "accent",
};

export default async function RolesPage({
  searchParams,
}: {
  searchParams?: Promise<{ role?: string; msg?: string; error?: string }>;
}) {
  const { perms, fetchFailed } = await getMyPerms();
  if (fetchFailed) return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <div className="notice bad"><p>権限情報を確認できませんでした。再読み込みするか担当者にご連絡ください。</p></div>
    </main>
  );
  if (!can(perms, "roles", "manage")) redirect("/");

  const sb = await createClient();
  const { data: roles } = await sb.from("roles").select("id, name, is_system").order("created_at");
  const { data: features } = await sb.from("features").select("key, label, grp, sort").order("sort");

  const sp = await searchParams;
  const selectedId = sp?.role ?? roles?.[0]?.id ?? "";
  const selectedRole = roles?.find((r) => r.id === selectedId) ?? roles?.[0] ?? null;

  const { data: permsData } = selectedRole
    ? await sb.from("role_permissions").select("feature_key, level").eq("role_id", selectedRole.id)
    : { data: [] };
  const permMap = Object.fromEntries((permsData ?? []).map((p) => [p.feature_key, p.level]));

  const msg = sp?.msg;
  const err = sp?.error;

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader eyebrow="設定" title="権限マスタ" description="役割ごとに、各機能へのアクセス水準を設定します。" />

      {msg && <div className="notice ok mb-4"><p>{msg}</p></div>}
      {err && <div className="notice bad mb-4"><p>{err}</p></div>}

      <div className="flex flex-col gap-8 md:flex-row md:gap-10">
        {/* 役割一覧 */}
        <div className="shrink-0 md:w-52">
          <h2 className="text-[11px] uppercase tracking-[0.2em] text-muted mb-3">役割</h2>
          <div className="flex flex-col gap-1 mb-4">
            {(roles ?? []).map((r) => (
              <a
                key={r.id}
                href={`/settings/roles?role=${r.id}`}
                className={[
                  "flex items-center justify-between rounded px-3 py-2 text-[13px] tracking-[0.04em]",
                  r.id === selectedRole?.id
                    ? "bg-surface text-accent border border-line font-medium"
                    : "text-text hover:bg-surface/60",
                ].join(" ")}
              >
                <span>{r.name}</span>
                {r.is_system && <StatusBadge label="システム" color="accent" className="text-[9px] px-1.5 py-0" />}
              </a>
            ))}
          </div>

          {/* 新規作成 */}
          <form action={createRole} className="border-t border-line pt-4">
            <div className="field">
              <label htmlFor="new-role-name" className="text-[11px]">新しい役割名</label>
              <input id="new-role-name" name="name" type="text" required placeholder="例：主任" maxLength={50} />
            </div>
            <button type="submit" className="primary w-full text-[13px]">作成する</button>
          </form>
        </div>

        {/* 権限編集 */}
        {selectedRole && (
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-[16px] font-semibold tracking-[0.06em]">{selectedRole.name}</h2>
              {selectedRole.is_system && <StatusBadge label="システム（変更不可）" color="accent" />}
            </div>

            {!selectedRole.is_system && (
              <div className="flex flex-wrap gap-3 mb-6">
                {/* 名前変更 */}
                <form action={updateRoleName} className="flex gap-2 items-end">
                  <input type="hidden" name="role_id" value={selectedRole.id} />
                  <div className="field mb-0">
                    <label htmlFor="rename" className="text-[11px]">名前を変更</label>
                    <input id="rename" name="name" type="text" defaultValue={selectedRole.name} required maxLength={50} />
                  </div>
                  <button type="submit" className="secondary mb-0" style={{ padding: "8px 14px" }}>変更</button>
                </form>
                {/* 削除 */}
                <form action={deleteRole} style={{ display: "flex", alignItems: "flex-end" }}>
                  <input type="hidden" name="role_id" value={selectedRole.id} />
                  <button type="submit" className="secondary"
                    style={{ padding: "8px 14px", fontSize: 13, color: "var(--bad)", borderColor: "var(--bad)" }}>削除</button>
                </form>
              </div>
            )}

            {/* 権限グリッド */}
            {selectedRole.is_system ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.14em] text-muted">
                      <th className="pb-2 pr-6 font-medium">機能</th>
                      <th className="pb-2 font-medium">水準</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(features ?? []).map((f) => (
                      <tr key={f.key} className="border-b border-line/50">
                        <td className="py-2.5 pr-6">{f.label}</td>
                        <td className="py-2.5"><StatusBadge label="管理" color="accent" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <form action={savePermissions}>
                <input type="hidden" name="role_id" value={selectedRole.id} />
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.14em] text-muted">
                        <th className="pb-2 pr-6 font-medium">機能</th>
                        {Object.keys(LEVEL_LABELS).map((l) => (
                          <th key={l} className="pb-2 pr-4 font-medium">{LEVEL_LABELS[l]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(features ?? []).map((f) => {
                        const current = permMap[f.key] ?? "none";
                        return (
                          <tr key={f.key} className="border-b border-line/50">
                            <td className="py-2.5 pr-6">{f.label}</td>
                            {Object.keys(LEVEL_LABELS).map((l) => (
                              <td key={l} className="py-2.5 pr-4">
                                <label className="flex items-center gap-1.5 cursor-pointer">
                                  <input
                                    type="radio"
                                    name={`level_${f.key}`}
                                    value={l}
                                    defaultChecked={current === l}
                                    className="accent-accent"
                                  />
                                  <StatusBadge label={LEVEL_LABELS[l]} color={current === l ? LEVEL_COLORS[l] : "muted"} className="text-[10px]" />
                                </label>
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="form-actions mt-4">
                  <button type="submit" className="primary">権限を保存する</button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
