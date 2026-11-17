import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { redirect } from "@/lib/redirect";
import { PageHeader } from "@/components/ui/PageHeader";
import { FlashMessage } from "@/components/ui/FlashMessage";
import { createClient } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { APP_NAME } from "@/lib/app-info";
import type { FormState } from "@/lib/form-state";
import type { CustomerValues } from "../CustomerForm";
import { CustomerForm } from "../CustomerForm";
import { updateCustomer } from "../actions";

export const metadata: Metadata = { title: `取引先編集 — ${APP_NAME}` };
export const dynamic = "force-dynamic";

type SP = Promise<{ error?: string }>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditCustomerPage({
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
  if (!can(perms, "customers", "view")) redirect("/");

  const sb = await createClient();
  const { data: c } = await sb
    .from("customers")
    .select("id, name, contact, email, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!c) notFound();

  const canEdit = can(perms, "customers", "edit");
  const canManage = can(perms, "customers", "manage");

  if (!canEdit) redirect("/master?error=編集権限がありません");

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader eyebrow="Master / 顧客" title="取引先編集" />
      <FlashMessage error={sp.error} />
      <CustomerForm
        id={c.id}
        action={(prev: FormState<CustomerValues>, formData: FormData) =>
          updateCustomer(c.id, prev, formData)
        }
        initial={{
          name: c.name,
          contact: c.contact ?? "",
          email: c.email ?? "",
        }}
        expectedUpdatedAt={c.updated_at}
        canManage={canManage}
      />
    </main>
  );
}
