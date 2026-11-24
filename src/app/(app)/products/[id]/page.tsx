import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { redirect } from "@/lib/redirect";
import { PageHeader } from "@/components/ui/PageHeader";
import { FlashMessage } from "@/components/ui/FlashMessage";
import { createClient } from "@/lib/supabase/server";
import { getMyPerms, can } from "@/lib/perm";
import { APP_NAME } from "@/lib/app-info";
import type { FormState } from "@/lib/form-state";
import type { ProductValues } from "../ProductForm";
import { ProductForm } from "../ProductForm";
import { updateProduct } from "../actions";

export const metadata: Metadata = { title: `商品編集 — ${APP_NAME}` };
export const dynamic = "force-dynamic";

type SP = Promise<{ error?: string }>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditProductPage({
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
  if (!can(perms, "products", "view")) redirect("/");

  const sb = await createClient();
  const { data: p } = await sb
    .from("products")
    .select("id, code, name, unit_price, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();

  const canEdit = can(perms, "products", "edit");
  const canManage = can(perms, "products", "manage");

  if (!canEdit) redirect("/products?error=編集権限がありません");

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader eyebrow="Master / 商品" title="商品編集" />
      <FlashMessage error={sp.error} />
      <ProductForm
        id={p.id}
        action={(prev: FormState<ProductValues>, formData: FormData) =>
          updateProduct(p.id, prev, formData)
        }
        initial={{
          code: p.code,
          name: p.name,
          unit_price: String(p.unit_price),
        }}
        expectedUpdatedAt={p.updated_at}
        canManage={canManage}
      />
    </main>
  );
}
