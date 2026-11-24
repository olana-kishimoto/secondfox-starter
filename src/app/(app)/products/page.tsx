import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { FlashMessage } from "@/components/ui/FlashMessage";
import { createClient } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { redirect } from "@/lib/redirect";
import { formatYen } from "@/lib/format";
import { APP_NAME } from "@/lib/app-info";
import { LinkButton } from "@/components/ui/Button";
import { IconSearch } from "@/components/icons";

export const metadata: Metadata = { title: `商品マスタ — ${APP_NAME}` };
export const dynamic = "force-dynamic";

type SP = Promise<{ q?: string; msg?: string; error?: string }>;

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  const { perms } = await getMyPerms();
  if (!can(perms, "products", "view")) redirect("/");

  const sb = await createClient();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  let query = sb.from("products").select("id, code, name, unit_price").order("code");
  if (q) {
    const safe = q.replace(/[,()%_\\]/g, " ").trim();
    if (safe) query = query.or(`name.ilike.%${safe}%,code.ilike.%${safe}%`);
  }
  const { data } = await query;
  const rows = data ?? [];

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow="Settings"
        title="商品マスタ"
        description="受注明細で選択できる商品の一覧です。"
        right={can(perms, "products", "edit") ? <LinkButton href="/products/new">商品を登録する</LinkButton> : undefined}
      />
      <FlashMessage msg={sp.msg} error={sp.error} />

      {/* 検索 */}
      <form method="GET" className="mb-4 flex items-center gap-2">
        <label className="relative flex-1 max-w-xs">
          <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
          <input
            name="q"
            defaultValue={q}
            placeholder="商品名・コードで絞り込み"
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
            href="/products"
            className="inline-flex items-center rounded border border-line px-4 py-[7px] text-[12px] text-text hover:border-accent hover:text-accent"
          >
            クリア
          </a>
        )}
        <span className="ml-auto text-[11px] text-muted">
          <span className="num text-text">{rows.length.toLocaleString()}</span> 件
        </span>
      </form>

      <div className="overflow-x-auto rounded-md border border-line bg-surface">
        <table className="master-table">
          <thead>
            <tr className="bg-base">
              <th>コード</th>
              <th>商品名</th>
              <th className="text-right">単価</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-base/50 transition-colors">
                <td data-label="コード" className="font-mono text-muted">{p.code}</td>
                <td data-label="商品名" className="font-medium">
                  {can(perms, "products", "edit") ? (
                    <a href={`/products/${p.id}`} className="hover:text-accent hover:underline">{p.name}</a>
                  ) : p.name}
                </td>
                <td data-label="単価" className="num text-right">{formatYen(p.unit_price)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={3} className="py-10 text-center text-muted" data-label="">
                  {q ? "条件に合う商品がありません" : "商品がまだ登録されていません"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
