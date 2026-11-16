import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubNav } from "@/components/ui/SubNav";
import { createClient } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { redirect } from "@/lib/redirect";
import { APP_NAME } from "@/lib/app-info";
import { IconSearch } from "@/components/icons";

export const metadata: Metadata = { title: `マスタ — ${APP_NAME}` };
export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string }>;

// マスタ（見本：顧客）。マスタが増えたら SubNav のタブに足していく。
export default async function MasterPage({ searchParams }: { searchParams: SP }) {
  const { perms } = await getMyPerms();
  if (!can(perms, "customers", "view")) redirect("/");

  const sb = await createClient();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  let query = sb.from("customers").select("id, name, contact, email").order("name");
  if (q) {
    const safe = q.replace(/[,()%_\\]/g, " ").trim();
    if (safe) query = query.or(`name.ilike.%${safe}%,contact.ilike.%${safe}%,email.ilike.%${safe}%`);
  }
  const { data } = await query;
  const rows = data ?? [];

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow="Settings"
        title="マスタ"
        description="業務で選ぶ項目のもとになるデータです。"
      />
      <SubNav items={[{ label: "顧客", href: "/master" }]} />

      {/* 検索 */}
      <form method="GET" className="mb-4 flex items-center gap-2">
        <label className="relative flex-1 max-w-xs">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
          <input
            name="q"
            defaultValue={q}
            placeholder="会社名・担当者・メールで絞り込み"
            className="w-full rounded border border-line bg-surface pl-8 pr-3 py-[7px] text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-soft"
          />
        </label>
        <button
          type="submit"
          className="inline-flex items-center rounded bg-accent px-4 py-[7px] text-[12px] font-medium tracking-[0.14em] text-white hover:bg-accent-2 active:scale-[0.97]"
        >
          検索
        </button>
        {q && (
          <a
            href="/master"
            className="inline-flex items-center rounded border border-line px-4 py-[7px] text-[12px] text-text hover:border-accent hover:text-accent"
          >
            クリア
          </a>
        )}
        <span className="ml-auto text-[11px] text-muted">
          <span className="num text-text">{rows.length.toLocaleString()}</span> 件
        </span>
      </form>

      {/* テーブル */}
      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="master-table">
          <thead>
            <tr className="bg-base">
              <th>会社名</th>
              <th>担当者</th>
              <th>メール</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td data-label="会社名" className="font-medium text-text">{c.name}</td>
                <td data-label="担当者" className="text-muted">{c.contact ?? "—"}</td>
                <td data-label="メール" className="text-muted">{c.email ?? "—"}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={3} className="py-10 text-center text-muted" data-label="">
                  {q ? "条件に合う顧客がいません" : "顧客がまだ登録されていません"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
