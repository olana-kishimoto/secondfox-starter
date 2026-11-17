import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { FlashMessage } from "@/components/ui/FlashMessage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createClient } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { orderStatusLabel } from "@/lib/labels";
import { APP_NAME } from "@/lib/app-info";
import type { FormState } from "@/lib/form-state";
import type { OrderValues } from "../OrderForm";
import { OrderForm } from "../OrderForm";
import { updateOrder } from "../actions";

export const metadata: Metadata = { title: `受注詳細 — ${APP_NAME}` };
export const dynamic = "force-dynamic";

type SP = Promise<{ error?: string }>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SP;
}) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();

  const { perms } = await getMyPerms();
  const canEdit = can(perms, "orders", "edit");

  const sb = await createClient();
  const [{ data: order }, { data: customers }, { data: products }] = await Promise.all([
    sb
      .from("orders")
      .select("id, order_no, customer_id, order_date, status, memo, updated_at, order_items(id, product_id, name, qty, unit_price, line_no)")
      .eq("id", id)
      .maybeSingle(),
    sb.from("customers").select("id, name, contact").order("name"),
    sb.from("products").select("id, code, name, unit_price").order("code"),
  ]);

  if (!order) notFound();

  const st = orderStatusLabel(order.status);

  // 明細を line_no 順に並べて OrderValues の items JSON に変換する
  const sortedItems = [...(order.order_items ?? [])].sort((a, b) => a.line_no - b.line_no);
  const itemsJson = JSON.stringify(
    sortedItems.map((it) => ({
      product_id: it.product_id ?? "",
      name: it.name,
      qty: it.qty,
      unit_price: it.unit_price,
    }))
  );

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow={`Orders / ${order.order_no}`}
        title="受注詳細"
        right={
          <div className="flex items-center gap-2">
            <Link
              href={`/orders/${order.id}/invoice`}
              className="inline-flex h-8 items-center rounded border border-line px-3 text-[12px] text-text hover:border-accent hover:text-accent"
            >
              請求書
            </Link>
            <StatusBadge label={st.label} color={st.color} />
          </div>
        }
      />
      <FlashMessage error={sp.error} />
      <OrderForm
        id={order.id}
        action={(prev: FormState<OrderValues>, formData: FormData) => updateOrder(order.id, prev, formData)}
        customers={customers ?? []}
        products={products ?? []}
        initial={{
          customer_id: order.customer_id ?? "",
          order_date: order.order_date,
          status: order.status,
          memo: order.memo ?? "",
          items: itemsJson,
        }}
        currentStatus={order.status}
        expectedUpdatedAt={order.updated_at}
        canEdit={canEdit}
      />
    </main>
  );
}
