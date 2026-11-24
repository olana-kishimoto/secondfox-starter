"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button, LinkButton } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { FlashMessage } from "@/components/ui/FlashMessage";
import { preventImplicitSubmit } from "@/lib/prevent-implicit-submit";
import type { FormState } from "@/lib/form-state";
import { deleteProduct } from "./actions";

export type ProductValues = {
  code: string;
  name: string;
  unit_price: string;
};

export function ProductForm({
  action,
  initial,
  id,
  expectedUpdatedAt,
  canManage,
}: {
  action: (prev: FormState<ProductValues>, formData: FormData) => Promise<FormState<ProductValues>>;
  initial: ProductValues;
  id?: string;
  expectedUpdatedAt?: string;
  canManage?: boolean;
}) {
  const [state, dispatch] = useActionState(action, { ok: true });

  const [code, setCode] = useState(initial.code);
  const [name, setName] = useState(initial.name);
  const [unitPrice, setUnitPrice] = useState(initial.unit_price);
  const [dirty, setDirty] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const fe = state.fieldErrors ?? {};

  useEffect(() => {
    if (!state.ok && state.values) {
      const v = state.values;
      setCode(v.code);
      setName(v.name);
      setUnitPrice(v.unit_price);
    }
  }, [state]);

  useEffect(() => {
    if (!state.ok) {
      const el = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']");
      el?.focus();
    }
  }, [state]);

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
        <div className="lg:col-span-3">
          <FlashMessage error={state.formError} />
        </div>
      )}
      <form
        ref={formRef}
        action={dispatch}
        onKeyDown={preventImplicitSubmit}
        className="rounded-md border border-line bg-surface p-5 lg:col-span-2"
      >
        {expectedUpdatedAt && (
          <input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} />
        )}

        <Field label="商品コード" htmlFor="code" required error={fe.code}>
          <Input
            id="code"
            name="code"
            value={code}
            onChange={(e) => { setCode(e.target.value); mark(); }}
            maxLength={50}
            placeholder="例：ITEM-001"
            required
            aria-invalid={fe.code ? true : undefined}
            aria-describedby={fe.code ? "err-code" : undefined}
          />
        </Field>

        <Field label="商品名" htmlFor="name" required error={fe.name}>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => { setName(e.target.value); mark(); }}
            maxLength={100}
            placeholder="例：スタンダードプラン"
            required
            aria-invalid={fe.name ? true : undefined}
            aria-describedby={fe.name ? "err-name" : undefined}
          />
        </Field>

        <Field label="単価（円）" htmlFor="unit_price" required error={fe.unit_price}>
          <Input
            id="unit_price"
            name="unit_price"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={unitPrice}
            onChange={(e) => { setUnitPrice(e.target.value); mark(); }}
            placeholder="例：50000"
            required
            aria-invalid={fe.unit_price ? true : undefined}
            aria-describedby={fe.unit_price ? "err-unit_price" : undefined}
          />
        </Field>

        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <SubmitButton pendingLabel="保存中…">{id ? "更新する" : "登録する"}</SubmitButton>
          <LinkButton href="/products" variant="ghost">一覧へ戻る</LinkButton>
        </div>
      </form>

      {id && canManage && (
        <aside className="h-fit rounded-md border border-line bg-surface p-5">
          <div className="mb-3 text-[10px] uppercase tracking-[0.14em] text-muted">操作</div>
          <ConfirmModal
            trigger={<Button type="button" variant="danger" className="w-full">削除する</Button>}
            title="この商品を削除しますか？"
            description="削除すると元に戻せません。受注明細で使われている商品は削除できません。"
            confirmLabel="削除する"
            onConfirm={() => deleteProduct(id)}
          />
        </aside>
      )}
    </div>
  );
}
