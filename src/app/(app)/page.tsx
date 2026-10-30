import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { FlashMessage } from "@/components/ui/FlashMessage";
import { Pagination } from "@/components/ui/Pagination";
import { SearchTemplates } from "@/components/ui/SearchTemplates";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DataCard } from "@/components/ui/DataCard";
import { LinkButton } from "@/components/ui/Button";
import { DateField } from "@/components/ui/DateField";
import { IconPlus, IconSearch } from "@/components/icons";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadSearchTemplates } from "@/lib/search-templates/actions";
import { SCREEN_KEYS } from "@/lib/screen-keys";
import { CASE_STATUS, caseStatusLabel } from "@/lib/labels";
import { formatDate, formatYen } from "@/lib/format";
import { DB_MISSING } from "@/lib/db-notice";
import { APP_NAME } from "@/lib/app-info";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: `案件一覧 — ${APP_NAME}` };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;
const SORTS = { created: "created_at", due: "due_date", amount: "amount", no: "case_no" } as const;
type SortKey = keyof typeof SORTS;
type SP = Promise<{
  q?: string; status?: string; customer?: string; from?: string; to?: string;
  sort?: string; dir?: string; page?: string; msg?: string; error?: string;
}>;

const inputCls =
  "w-full rounded border border-line bg-surface px-3 py-[8px] text-[13px] focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-soft";

// 案件一覧（見本画面）。検索カード → 一覧（サーバーでの絞り込み・並べ替え・ページ送り）→ 行から編集。
export default async function CasesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = CASE_STATUS[sp.status ?? ""] ? sp.status! : "";
  const customer = sp.customer ?? "";
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from! : "";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to! : "";
  const sort: SortKey = sp.sort && sp.sort in SORTS ? (sp.sort as SortKey) : "created";
  const dir = sp.dir === "asc" ? "asc" : "desc";
  const page = Math.max(1, Math.floor(Number(sp.page ?? 1)) || 1);

  const sb = createAdminClient();
  const templates = await loadSearchTemplates(SCREEN_KEYS.CASES);

  type Row = { id: string; case_no: string; title: string; status: string; amount: number; due_date: string | null; customers: { name: string } | null };
  let rows: Row[] = [];
  let count = 0;
  let customers: { id: string; name: string }[] = [];
  let error = sp.error;

  if (!sb) {
    error = DB_MISSING;
  } else {
    const { data: cs } = await sb.from("customers").select("id, name").order("name");
    customers = cs ?? [];

    let query = sb
      .from("cases")
      .select("id, case_no, title, status, amount, due_date, customers(name)", { count: "exact" });
    // .or() の区切りに使われる文字は検索語から外す
    const safeQ = q.replace(/[,()%_\\]/g, " ").trim();
    if (safeQ) query = query.or(`title.ilike.%${safeQ}%,case_no.ilike.%${safeQ}%`);
    if (status) query = query.eq("status", status);
    if (/^[0-9a-f-]{36}$/i.test(customer)) query = query.eq("customer_id", customer);
    if (from) query = query.gte("due_date", from);
    if (to) query = query.lte("due_date", to);

    const res = await query
      .order(SORTS[sort], { ascending: dir === "asc", nullsFirst: false })
      .order("case_no", { ascending: dir === "asc" })
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
  if (from) filterParams.set("from", from);
  if (to) filterParams.set("to", to);
  const sortParams = new URLSearchParams(filterParams);
  if (sort !== "created" || dir !== "desc") { sortParams.set("sort", sort); sortParams.set("dir", dir); }
  const basePath = sortParams.toString() ? `/?${sortParams}` : "/";
  const hasFilter = filterParams.size > 0;

  // 見出しクリックで並べ替え（同じ列をもう一度で昇降を切り替え）
  const sortHref = (key: SortKey) => {
    const p = new URLSearchParams(filterParams);
    p.set("sort", key);
    p.set("dir", sort === key && dir === "desc" ? "asc" : "desc");
    return `/?${p}`;
  };
  const SortTh = ({ k, label, align }: { k: SortKey; label: string; align: "left" | "right" }) => (
    <th className={cn("px-4 py-3", align === "right" ? "text-right" : "text-left")}>
      <Link href={sortHref(k)} className={cn("inline-flex items-center gap-1 hover:text-accent", sort === k && "text-accent")}>
        {label}
        <span aria-hidden className="text-[9px]">{sort === k ? (dir === "asc" ? "▲" : "▼") : ""}</span>
      </Link>
    </th>
  );

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow="Cases"
        title="案件一覧"
        description="案件の検索・確認・更新をここから行います。行を選ぶと編集できます。"
        right={
          <LinkButton href="/cases/new">
            <IconPlus size={14} />案件登録
          </LinkButton>
        }
      />
      <FlashMessage msg={sp.msg} error={error} />

      {/* 検索カード */}
      <section className="mb-5 rounded-md border border-line bg-surface p-4">
        <SearchTemplates screenKey={SCREEN_KEYS.CASES} templates={templates} />
        <form method="GET" className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <label className="relative col-span-2">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-muted">キーワード</span>
            <IconSearch className="absolute left-3 top-[31px] h-3.5 w-3.5 text-muted" />
            <input name="q" defaultValue={q} placeholder="件名・案件番号" className={cn(inputCls, "pl-8")} />
          </label>
          <label>
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-muted">状態</span>
            <select name="status" defaultValue={status} className={inputCls}>
              <option value="">すべて</option>
              {Object.entries(CASE_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-muted">顧客</span>
            <select name="customer" defaultValue={customer} className={inputCls}>
              <option value="">すべて</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label>
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-muted">期限（から）</span>
            <DateField name="from" defaultValue={from} className={inputCls} />
          </label>
          <label>
            <span className="mb-1 block text-[10px] uppercase tracking-[0.14em] text-muted">期限（まで）</span>
            <DateField name="to" defaultValue={to} className={inputCls} />
          </label>
          {sort !== "created" || dir !== "desc" ? (
            <>
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="dir" value={dir} />
            </>
          ) : null}
          <div className="col-span-2 flex items-center gap-2 md:col-span-6">
            <button type="submit" className="h-9 inline-flex items-center rounded bg-accent px-5 text-[12px] font-medium tracking-[0.16em] text-white hover:bg-accent-2 active:scale-[0.97]">
              検索
            </button>
            {hasFilter && (
              <Link href="/" className="h-9 inline-flex items-center rounded border border-line px-4 text-[12px] text-text hover:border-accent hover:text-accent">
                条件をクリア
              </Link>
            )}
            <span className="ml-auto text-[11px] text-muted">
              <span className="num text-text">{count.toLocaleString()}</span> 件
            </span>
          </div>
        </form>
      </section>

      {/* 一覧（PC：テーブル／スマホ：カード） */}
      <div className="hidden overflow-x-auto rounded-md border border-line bg-surface md:block">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-line bg-base text-[10px] uppercase tracking-[0.14em] text-muted">
              <SortTh k="no" label="案件番号" align="left" />
              <th className="px-4 py-3 text-left">件名</th>
              <th className="px-4 py-3 text-left">顧客</th>
              <SortTh k="due" label="期限" align="right" />
              <SortTh k="amount" label="金額" align="right" />
              <th className="px-4 py-3 text-center">状態</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const st = caseStatusLabel(r.status);
              return (
                <tr key={r.id} className={cn("border-b border-line last:border-0 hover:bg-base/60", i % 2 === 1 && "bg-base/40")}>
                  <td className="px-4 py-3">
                    <Link href={`/cases/${r.id}`} className="font-mono text-[12px] text-accent hover:underline">{r.case_no}</Link>
                  </td>
                  <td className="px-4 py-3">{r.title}</td>
                  <td className="px-4 py-3 text-muted">{r.customers?.name ?? "—"}</td>
                  <td className="num px-4 py-3 text-right text-muted">{formatDate(r.due_date)}</td>
                  <td className="num px-4 py-3 text-right font-medium">{formatYen(r.amount)}</td>
                  <td className="px-4 py-3 text-center"><StatusBadge label={st.label} color={st.color} /></td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted">
                {hasFilter ? "条件に合う案件がありません" : "案件がありません。「案件登録」から追加してください"}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((r) => {
          const st = caseStatusLabel(r.status);
          return (
            <DataCard key={r.id} href={`/cases/${r.id}`}>
              <DataCard.Header right={<StatusBadge label={st.label} color={st.color} />}>
                <DataCard.Eyebrow>{r.case_no}</DataCard.Eyebrow>
              </DataCard.Header>
              <DataCard.Title>{r.title}</DataCard.Title>
              <DataCard.Sub>{r.customers?.name ?? "顧客未設定"}</DataCard.Sub>
              <DataCard.MetaRow>
                <DataCard.Meta label="期限" value={formatDate(r.due_date)} mono />
                <DataCard.Meta label="金額" value={formatYen(r.amount)} mono align="right" />
              </DataCard.MetaRow>
            </DataCard>
          );
        })}
        {!rows.length && <p className="py-10 text-center text-muted">案件がありません</p>}
      </div>

      <Pagination basePath={basePath} page={page} totalPages={totalPages} total={count} pageSize={PAGE_SIZE} />
    </main>
  );
}
