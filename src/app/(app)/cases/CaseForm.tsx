"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { DateField } from "@/components/ui/DateField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button, LinkButton } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SearchModal } from "@/components/ui/SearchModal";
import { CASE_STATUS } from "@/lib/labels";
import { foldIncludes } from "@/lib/fold-search";
import { preventImplicitSubmit } from "@/lib/prevent-implicit-submit";
import { IconSearch } from "@/components/icons";
import type { FormState } from "@/lib/form-state";
import { deleteCase, setCaseStatus } from "./actions";

export type CustomerOption = { id: string; name: string; contact: string | null };
export type CaseValues = {
  title: string;
  customer_id: string;
  status: string;
  amount: number;
  due_date: string;
  memo: string;
};

// 新規／編集の共通フォーム。A-2（入力を失わせない）とA-3（競合検出）の参照実装。
export function CaseForm({
  action,
  customers,
  initial,
  id,
  expectedUpdatedAt,
}: {
  action: (prev: FormState<CaseValues>, formData: FormData) => Promise<FormState<CaseValues>>;
  customers: CustomerOption[];
  initial: CaseValues;
  id?: string;
  expectedUpdatedAt?: string;
}) {
  const [state, dispatch] = useActionState(action, { ok: true });

  // Controlled state — synced from state.values on error so user input is never lost (A-2)
  const [title, setTitle] = useState(initial.title);
  const [customerId, setCustomerId] = useState(initial.customer_id);
  const [status, setStatus] = useState(initial.status);
  const [amount, setAmount] = useState(initial.amount);
  const [dueDate, setDueDate] = useState(initial.due_date);
  const [memo, setMemo] = useState(initial.memo);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [hits, setHits] = useState<CustomerOption[]>(customers);
  const [dirty, setDirty] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const customerName = customers.find((c) => c.id === customerId)?.name ?? "";
  const fe = state.fieldErrors ?? {};

  // A-2: Restore field values from state.values when server returns an error
  useEffect(() => {
    if (!state.ok && state.values) {
      const v = state.values;
      setTitle(v.title);
      setCustomerId(v.customer_id);
      setStatus(v.status);
      setAmount(v.amount);
      setDueDate(v.due_date);
      setMemo(v.memo);
    }
  }, [state]);

  // A-2: Focus the first field with an error
  useEffect(() => {
    if (!state.ok) {
      const el = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']");
      el?.focus();
    }
  }, [state]);

  // A-2: Warn before leaving with unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const mark = () => setDirty(true);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {state.formError && (
        <div className="notice bad lg:col-span-3">{state.formError}</div>
      )}
      <form
        ref={formRef}
        action={dispatch}
        onKeyDown={preventImplicitSubmit}
        className="rounded-md border border-line bg-surface p-5 lg:col-span-2"
      >
        <input type="hidden" name="customer_id" value={customerId} />
        {expectedUpdatedAt && (
          <input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} />
        )}

        <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <Field label="件名" htmlFor="title" required error={fe.title}>
              <Input
                id="title"
                name="title"
                value={title}
                onChange={(e) => { setTitle(e.target.value); mark(); }}
                maxLength={100}
                placeholder="例：年間保守契約の更新"
                required
                aria-invalid={fe.title ? true : undefined}
                aria-describedby={fe.title ? "err-title" : undefined}
              />
            </Field>
          </div>

          <Field label="顧客" htmlFor="customer_name" hint="検索ボタンから顧客マスタを選びます">
            <div className="flex gap-2">
              <Input
                id="customer_name"
                value={customerName}
                placeholder="未選択"
                readOnly
                onClick={() => setPickerOpen(true)}
                className="cursor-pointer"
              />
              <Button type="button" variant="ghost" onClick={() => setPickerOpen(true)} aria-label="顧客を検索">
                <IconSearch size={14} />
              </Button>
              {customerId && (
                <Button type="button" variant="ghost" onClick={() => { setCustomerId(""); mark(); }}>解除</Button>
              )}
            </div>
          </Field>

          <Field label="状態" htmlFor="status" required error={fe.status}>
            <Select
              id="status"
              name="status"
              value={status}
              onChange={(e) => { setStatus(e.target.value); mark(); }}
              aria-invalid={fe.status ? true : undefined}
              aria-describedby={fe.status ? "err-status" : undefined}
            >
              {Object.entries(CASE_STATUS).map(([v, s]) => (
                <option key={v} value={v}>{s.label}</option>
              ))}
            </Select>
          </Field>

          <Field label="金額（円）" htmlFor="amount" error={fe.amount}>
            <Input
              id="amount"
              name="amount"
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={amount}
              onChange={(e) => { setAmount(Number(e.target.value)); mark(); }}
              className="num text-right"
              aria-invalid={fe.amount ? true : undefined}
              aria-describedby={fe.amount ? "err-amount" : undefined}
            />
          </Field>

          <Field label="期限" htmlFor="due_date" error={fe.due_date}>
            <DateField
              id="due_date"
              name="due_date"
              value={dueDate}
              onChange={(e) => { setDueDate(e.target.value); mark(); }}
              className="w-full rounded border border-line bg-surface px-3 py-[7px] text-[13px] text-text focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-soft"
              aria-invalid={fe.due_date ? true : undefined}
              aria-describedby={fe.due_date ? "err-due_date" : undefined}
            />
          </Field>

          <div className="md:col-span-2">
            <Field label="メモ" htmlFor="memo" error={fe.memo}>
              <Textarea
                id="memo"
                name="memo"
                value={memo}
                onChange={(e) => { setMemo(e.target.value); mark(); }}
                maxLength={1000}
                rows={4}
              />
            </Field>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <SubmitButton pendingLabel="保存中…">{id ? "更新する" : "登録する"}</SubmitButton>
          <LinkButton href="/" variant="ghost">一覧へ戻る</LinkButton>
        </div>
      </form>

      {id ? (
        <aside className="h-fit rounded-md border border-line bg-surface p-5">
          <div className="mb-3 text-[10px] uppercase tracking-[0.14em] text-muted">操作</div>
          <div className="flex flex-col gap-2">
            {initial.status !== "done" && (
              <ConfirmModal
                trigger={<Button type="button" variant="ghost" className="w-full">完了にする</Button>}
                title="この案件を完了にしますか？"
                description="状態が「完了」に変わります。あとから編集で戻せます。"
                confirmLabel="完了にする"
                variant="primary"
                onConfirm={() => setCaseStatus(id, "done")}
              />
            )}
            <ConfirmModal
              trigger={<Button type="button" variant="danger" className="w-full">削除する</Button>}
              title="この案件を削除しますか？"
              description="削除すると元に戻せません。"
              confirmLabel="削除する"
              onConfirm={() => deleteCase(id)}
            />
          </div>
        </aside>
      ) : (
        <aside className="h-fit rounded-md border border-line bg-base/40 p-5 text-[12px] leading-[1.9] text-muted">
          <div className="mb-2 text-[10px] uppercase tracking-[0.14em]">入力のしかた</div>
          件名だけ入れれば登録できます。案件番号は自動で付きます。顧客・金額・期限は、あとから編集でも入れられます。
        </aside>
      )}

      <SearchModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="顧客を選ぶ"
        searchPlaceholder="顧客名・担当者で検索"
        columns={[{ key: "name", label: "顧客名" }, { key: "contact", label: "担当者" }]}
        rows={hits as unknown as Record<string, unknown>[]}
        onSearch={(q) => setHits(customers.filter((c) => foldIncludes(c.name, q) || foldIncludes(c.contact, q)))}
        onSelect={(row) => { setCustomerId(String(row.id)); setPickerOpen(false); mark(); }}
      />
    </div>
  );
}
