import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubNav } from "@/components/ui/SubNav";
import { DataCard } from "@/components/ui/DataCard";
import { createClient } from "@/lib/supabase/server";
import { APP_NAME } from "@/lib/app-info";

export const metadata: Metadata = { title: `マスタ — ${APP_NAME}` };
export const dynamic = "force-dynamic";

// マスタ（見本：顧客）。マスタが増えたら SubNav のタブに足していく。
export default async function MasterPage() {
  const sb = await createClient();
  const { data } = await sb.from("customers").select("id, name, contact, email").order("name");

  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <PageHeader eyebrow="Settings" title="マスタ" description="業務で選ぶ項目のもとになるデータです。" />
      <SubNav items={[{ label: "顧客", href: "/master" }]} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(data ?? []).map((c) => (
          <DataCard key={c.id}>
            <DataCard.Title>{c.name}</DataCard.Title>
            <DataCard.Sub>{c.contact ?? "担当者未設定"}</DataCard.Sub>
            <DataCard.MetaRow>
              <DataCard.Meta label="メール" value={c.email ?? "—"} />
            </DataCard.MetaRow>
          </DataCard>
        ))}
        {!(data ?? []).length && <p className="py-10 text-muted">顧客がまだ登録されていません</p>}
      </div>
    </main>
  );
}
