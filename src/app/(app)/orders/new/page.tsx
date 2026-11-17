import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { redirect } from "@/lib/redirect";
import { APP_NAME } from "@/lib/app-info";
import { OrderForm } from "../OrderForm";
import { createOrder } from "../actions";

export const metadata: Metadata = { title: `受注登録 — ${APP_NAME}` };
export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const { perms } = await getMyPerms();
  if (!can(perms, "orders", "edit")) redirect("/orders");

  const sb = await createClient();
  const [{ data: customers }, { data: products }] = await Promise.all([
    sb.from("customers").select("id, name, contact").order("name"),
    sb.from("products").select("id, code, name, unit_price").order("code"),
  ]);

  const today = new Date().toLocaleDateString("sv"); // YYYY-MM-DD

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader eyebrow="Orders" title="受注登録" description="受注を登録します。明細を1行以上入力してください。" />
      <OrderForm
        action={createOrder}
        customers={customers ?? []}
        products={products ?? []}
        initial={{ customer_id: "", order_date: today, status: "draft", memo: "", items: "[]" }}
        canEdit={true}
      />
    </main>
  );
}
