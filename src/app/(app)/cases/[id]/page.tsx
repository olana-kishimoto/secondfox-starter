import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { FlashMessage } from "@/components/ui/FlashMessage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { createAdminClient } from "@/lib/supabase/admin";
import { caseStatusLabel } from "@/lib/labels";
import { DB_MISSING } from "@/lib/db-notice";
import { APP_NAME } from "@/lib/app-info";
import { CaseForm } from "../CaseForm";
import { updateCase } from "../actions";

export const metadata: Metadata = { title: `案件編集 — ${APP_NAME}` };
export const dynamic = "force-dynamic";

type SP = Promise<{ error?: string }>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditCasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SP }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID.test(id)) notFound();
  const sb = createAdminClient();
  if (!sb) {
    return (
      <main className="px-4 py-6 md:px-8 md:py-8">
        <PageHeader eyebrow="Cases" title="案件編集" />
        <FlashMessage error={DB_MISSING} />
      </main>
    );
  }
  const [{ data: c }, { data: customers }] = await Promise.all([
    sb.from("cases").select("id, case_no, title, customer_id, status, amount, due_date, memo").eq("id", id).maybeSingle(),
    sb.from("customers").select("id, name, contact").order("name"),
  ]);
  if (!c) notFound();
  const st = caseStatusLabel(c.status);

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader
        eyebrow={`Cases / ${c.case_no}`}
        title="案件編集"
        right={<StatusBadge label={st.label} color={st.color} />}
      />
      <FlashMessage error={sp.error} />
      <CaseForm
        id={c.id}
        action={updateCase.bind(null, c.id)}
        customers={customers ?? []}
        initial={{
          title: c.title,
          customer_id: c.customer_id ?? "",
          status: c.status,
          amount: c.amount,
          due_date: c.due_date ?? "",
          memo: c.memo ?? "",
        }}
      />
    </main>
  );
}
