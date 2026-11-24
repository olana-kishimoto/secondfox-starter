import type { Metadata } from "next";
import { redirect } from "@/lib/redirect";
import { PageHeader } from "@/components/ui/PageHeader";
import { getMyPerms, can } from "@/lib/perm";
import { APP_NAME } from "@/lib/app-info";
import { ProductForm } from "../ProductForm";
import { createProduct } from "../actions";

export const metadata: Metadata = { title: `商品登録 — ${APP_NAME}` };
export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const { perms } = await getMyPerms();
  if (!can(perms, "products", "edit")) redirect("/products");

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader eyebrow="Master / 商品" title="商品登録" description="コード・商品名・単価を入力してください。" />
      <ProductForm
        action={createProduct}
        initial={{ code: "", name: "", unit_price: "" }}
      />
    </main>
  );
}
