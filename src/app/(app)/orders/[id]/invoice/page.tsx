import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sheet } from "@/components/print/Sheet";
import { PrintButton } from "@/components/print/PrintButton";
import { createClient } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { formatDateJP, formatYen } from "@/lib/format";
import { APP_NAME } from "@/lib/app-info";

export const metadata: Metadata = { title: `請求書 — ${APP_NAME}` };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const { perms } = await getMyPerms();
  if (!can(perms, "orders", "view")) notFound();

  const sb = await createClient();
  const { data: raw } = await sb
    .from("orders")
    .select(
      "id, order_no, order_date, status, memo, customers(name, contact), order_items(id, name, qty, unit_price, amount, line_no)"
    )
    .eq("id", id)
    .maybeSingle();

  if (!raw) notFound();

  type Customer = { name: string; contact: string | null } | null;
  type Item = { id: string; name: string; qty: number; unit_price: number; amount: number | null; line_no: number };
  const order = raw as typeof raw & { customers: Customer; order_items: Item[] };
  const customer = Array.isArray(order.customers) ? (order.customers[0] as Customer) : order.customers;

  const items = [...(order.order_items ?? [])].sort((a, b) => a.line_no - b.line_no);
  const subtotal = items.reduce((s, it) => s + (it.amount ?? 0), 0);
  const tax = Math.floor(subtotal * 0.1);
  const total = subtotal + tax;
  const issuedDate = formatDateJP(new Date().toISOString().slice(0, 10));

  return (
    <div className="print-root">
      {/* 画面操作バー（印刷時は no-print で隠す） */}
      <div className="no-print flex items-center gap-3 border-b border-line bg-surface px-6 py-3">
        <Link
          href={`/orders/${id}`}
          className="text-[12px] text-accent hover:underline"
        >
          ← 受注詳細に戻る
        </Link>
        <Link
          href="/orders"
          className="text-[12px] text-muted hover:text-text"
        >
          受注一覧
        </Link>
        <span className="ml-auto text-[11px] text-muted">
          印刷プレビューで A4 1枚に収まることを確認してください
        </span>
        <PrintButton />
      </div>


      {/* A4 台紙 */}
      <Sheet>
        {/* 発行者 */}
        <div className="mb-8 text-right text-[9pt]" style={{ color: "#555" }}>
          <div className="text-[11pt] font-bold" style={{ color: "#111" }}>
            {APP_NAME}
          </div>
          <div>発行日：{issuedDate}</div>
        </div>

        {/* タイトル */}
        <h1
          className="mb-6 text-center text-[22pt] font-bold tracking-widest"
          style={{ color: "#111", letterSpacing: "0.3em" }}
        >
          請　求　書
        </h1>

        {/* 宛先 */}
        <div className="mb-6">
          <div className="text-[13pt] font-bold" style={{ borderBottom: "2px solid #111", paddingBottom: "4px", marginBottom: "2px" }}>
            {customer?.name ?? "（取引先未設定）"} 御中
          </div>
          {customer?.contact && (
            <div className="text-[9pt]" style={{ color: "#555" }}>
              担当：{customer.contact}
            </div>
          )}
        </div>

        {/* 受注番号・受注日 */}
        <div className="mb-5 flex gap-6 text-[9pt]" style={{ color: "#555" }}>
          <span>受注番号：<span style={{ color: "#111", fontFamily: "monospace" }}>{order.order_no}</span></span>
          <span>受注日：{formatDateJP(order.order_date)}</span>
        </div>

        {/* 合計金額 */}
        <div
          className="mb-6 flex items-baseline justify-between"
          style={{ border: "1px solid #ccc", padding: "10px 16px", background: "#f9f9f9" }}
        >
          <span className="text-[10pt]">ご請求金額（税込）</span>
          <span className="text-[20pt] font-bold" style={{ color: "#111", fontVariantNumeric: "tabular-nums" }}>
            {formatYen(total)}
          </span>
        </div>

        {/* 明細表 */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9pt" }}>
          <thead>
            <tr style={{ background: "#333", color: "#fff" }}>
              <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 500 }}>品名</th>
              <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>数量</th>
              <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>単価</th>
              <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>金額</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr
                key={it.id}
                style={{
                  borderBottom: "1px solid #ddd",
                  background: i % 2 === 1 ? "#f5f5f5" : "#fff",
                  breakInside: "avoid",
                }}
              >
                <td style={{ padding: "6px 10px" }}>{it.name}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {it.qty.toLocaleString("ja-JP")}
                </td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {formatYen(it.unit_price)}
                </td>
                <td style={{ padding: "6px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                  {formatYen(it.amount ?? it.qty * it.unit_price)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* 小計・消費税・合計 */}
        <div className="mt-2 ml-auto" style={{ width: "240px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 10px", fontSize: "9pt" }}>
            <span>小計</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatYen(subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 10px", fontSize: "9pt", color: "#555" }}>
            <span>消費税（10%）</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatYen(tax)}</span>
          </div>
          <div
            style={{
              display: "flex", justifyContent: "space-between",
              padding: "6px 10px", fontSize: "11pt", fontWeight: "bold",
              borderTop: "2px solid #111", marginTop: "4px",
            }}
          >
            <span>合計（税込）</span>
            <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatYen(total)}</span>
          </div>
        </div>

        {/* 備考 */}
        {order.memo && (
          <div className="mt-6 text-[9pt]" style={{ color: "#555" }}>
            <div style={{ fontWeight: 500, marginBottom: "2px" }}>備考</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{order.memo}</div>
          </div>
        )}

        {/* 印影欄 */}
        <div className="mt-10 flex justify-end">
          <div
            style={{
              width: "80px", height: "80px",
              border: "1px solid #bbb",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "8pt", color: "#aaa",
            }}
          >
            印
          </div>
        </div>
      </Sheet>
    </div>
  );
}

