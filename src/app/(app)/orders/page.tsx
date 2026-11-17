import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { FlashMessage } from "@/components/ui/FlashMessage";
import { Pagination } from "@/components/ui/Pagination";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataCard } from "@/components/ui/DataCard";
import { LinkButton } from "@/components/ui/Button";
import { IconSearch, IconPlus } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { ORDER_STATUS, orderStatusLabel } from "@/lib/labels";
import { formatDate, formatYen } from "@/lib/format";
import { APP_NAME } from "@/lib/app-info";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: `受注一覧 — ${APP_NAME}` };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;
type SP = Promise<{
  q?: string; status?: string; customer?: string;
  page?: string; msg?: string; error?: string;
}>;

const inputCls =
  "w-full rounded border border-line bg-surface px-3 py-[8px] text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-soft";

export default async function OrdersPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { perms } = await getMyPerms();
  const q        = (sp.q ?? "").trim();
  const status   = ORDER_STATUS[sp.status ?? ""] ? sp.status! : "";
  const customer = sp.customer ?? "";
  const page     = Math.max(1, Math.floor(Number(sp.page ?? 1)) || 1);
  const canEdit  = can(perms, "orders", "edit");

  const sb = await createClient();

  type Row = {
    id: string;
    order_no: string;
    order_date: string;
    status: string;
    customers: { name: string } | null;
    order_items: { amount: number }[];
  };
  let rows: Row[] = [];
  let count = 0;
  let customers: { id: string; name: string }[] = [];
  let error = sp.error;

  {
    const { data: cs } = await sb.from("customers").select("id, name").order("name");
    customers = cs ?? [];

    let query = sb
      .from("orders")
      .select("id, order_no, order_date, status, customers(name), order_items(amount)", { count: "exact" });
    const safeQ = q.replace(/[,()%_\\]/g, " ").trim();
    if (safeQ) query = query.or(`order_no.ilike.%${safeQ}%`);
    if (status) query = query.eq("status", status);
    if (/^[0-9a-f-]{36}$/i.test(customer)) query = query.eq("customer_id", customer);
    const res = await query
      .order("created_at", { ascending: false })
      .order("order_no", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
    if (res.error) error = "一覧を読み込めませんでした。時間をおいて再度お試しください。";
    rows = (res.data ?? []) as unknown as Row[];
    count = res.count ?? 0;
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const filterParams = new URLSearchParams();
  if (q) filterParams.set("q", q);
  if (status) filterParams.set("status", status);
  if (customer) filterParams.set("customer", customer);
  const basePath = filterParams.toString() ? `/orders?${filterParams}` : "/orders";
  const hasFilter = filterParams.size > 0;

  const rowTotal = (r: Row) => (r.order_items ?? []).reduce((s, it) => s + (it.amount ?? 0), 0);

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow="Orders"
        title="受注一覧"
        description="受注の検索・確認・更新をここから行います。"
        right={canEdit ? (
          <LinkButton href="/orders/new">
            <IconPlus size={14} />受注登録
          </LinkButton>
        ) : undefined}
      />
      <FlashMessage msg={sp.msg} error={error} />

      {/* 検索カード */}
      <section className="mb-5 rounded-md border border-line bg-surface p-4">
        <form method="GET" className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="relative col-span-2 md:col-span-1">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-muted">受注番号</span>
            <IconSearch className="absolute left-3 top-[31px] h-3.5 w-3.5 text-muted" />
            <input name="q" defaultValue={q} placeholder="SO-00001" className={cn(inputCls, "pl-8")} />
          </label>
          <label>
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-muted">状態</span>
            <select name="status" defaultValue={status} className={inputCls}>
              <option value="">すべて</option>
              {Object.entries(ORDER_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-muted">取引先</span>
            <select name="customer" defaultValue={customer} className={inputCls}>
              <option value="">すべて</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div className="col-span-2 flex items-center gap-2 md:col-span-4">
            <button type="submit" className="h-9 inline-flex items-center rounded bg-accent px-5 text-[12px] font-medium tracking-[0.16em] text-white hover:bg-accent-2 active:scale-[0.97]">
              検索
            </button>
            {hasFilter && (
              <Link href="/orders" className="h-9 inline-flex items-center rounded border border-line px-4 text-[12px] text-text hover:border-accent hover:text-accent">
                条件をクリア
              </Link>
            )}
            <span className="ml-auto text-[11px] text-muted">
              <span className="num text-text">{count.toLocaleString()}</span> 件
            </span>
          </div>
        </form>
      </section>

      {/* PC テーブル */}
      <div className="hidden overflow-x-auto rounded-md border border-line bg-surface md:block">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line bg-base text-[10px] uppercase tracking-[0.14em] text-muted">
              <th className="px-4 py-3 text-left">受注番号</th>
              <th className="px-4 py-3 text-left">取引先</th>
              <th className="px-4 py-3 text-right">受注日</th>
              <th className="px-4 py-3 text-right">金額合計</th>
              <th className="px-4 py-3 text-center">状態</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const st = orderStatusLabel(r.status);
              return (
                <tr key={r.id} className={cn("border-b border-line last:border-0 hover:bg-base/60", i % 2 === 1 && "bg-base/40")}>
                  <td className="px-4 py-3">
                    <Link href={`/orders/${r.id}`} className="font-mono text-[12px] text-accent hover:underline">{r.order_no}</Link>
                  </td>
                  <td className="px-4 py-3">{r.customers?.name ?? "—"}</td>
                  <td className="num px-4 py-3 text-right text-muted">{formatDate(r.order_date)}</td>
                  <td className="num px-4 py-3 text-right font-medium">{formatYen(rowTotal(r))}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge label={st.label} color={st.color} /></td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">
                {hasFilter ? "条件に合う受注がありません" : "受注がありません。「受注登録」から追加してください"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* スマホ カード */}
      <div className="space-y-2 md:hidden">
        {rows.map((r) => {
          const st = orderStatusLabel(r.status);
          return (
            <DataCard key={r.id} href={`/orders/${r.id}`}>
              <DataCard.Header right={<StatusBadge label={st.label} color={st.color} />}>
                <DataCard.Eyebrow>{r.order_no}</DataCard.Eyebrow>
              </DataCard.Header>
              <DataCard.Title>{r.customers?.name ?? "取引先未設定"}</DataCard.Title>
              <DataCard.MetaRow>
                <DataCard.Meta label="受注日" value={formatDate(r.order_date)} mono />
                <DataCard.Meta label="金額合計" value={formatYen(rowTotal(r))} mono align="right" />
              </DataCard.MetaRow>
            </DataCard>
          );
        })}
        {!rows.length && <p className="py-10 text-center text-muted">受注がありません</p>}
      </div>

      <Pagination basePath={basePath} page={page} totalPages={totalPages} total={count} pageSize={PAGE_SIZE} />
    </main>
  );
}
