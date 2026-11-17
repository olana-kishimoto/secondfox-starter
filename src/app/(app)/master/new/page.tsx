import type { Metadata } from "next";
import { redirect } from "@/lib/redirect";
import { PageHeader } from "@/components/ui/PageHeader";
import { getMyPerms, can } from "@/lib/perm";
import { APP_NAME } from "@/lib/app-info";
import { CustomerForm } from "../CustomerForm";
import { createCustomer } from "../actions";

export const metadata: Metadata = { title: `取引先登録 — ${APP_NAME}` };
export const dynamic = "force-dynamic";

export default async function NewCustomerPage() {
  const { perms } = await getMyPerms();
  if (!can(perms, "customers", "edit")) redirect("/master");

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader eyebrow="Master / 顧客" title="取引先登録" description="会社名だけで登録できます。" />
      <CustomerForm
        action={createCustomer}
        initial={{ name: "", contact: "", email: "" }}
      />
    </main>
  );
}
