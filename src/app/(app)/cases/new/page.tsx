import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { FlashMessage } from "@/components/ui/FlashMessage";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/app-info";
import { CaseForm } from "../CaseForm";
import { createCase } from "../actions";

export const metadata: Metadata = { title: `案件登録 — ${APP_NAME}` };
export const dynamic = "force-dynamic";

type SP = Promise<{ error?: string }>;

export default async function NewCasePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const sb = await createClient();
  const { data } = await sb.from("customers").select("id, name, contact").order("name");

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader eyebrow="Cases" title="案件登録" description="案件を登録します。件名だけで登録できます。" />
      <FlashMessage error={sp.error} />
      <CaseForm
        action={createCase}
        customers={data ?? []}
        initial={{ title: "", customer_id: "", status: "draft", amount: 0, due_date: "", memo: "" }}
      />
    </main>
  );
}
