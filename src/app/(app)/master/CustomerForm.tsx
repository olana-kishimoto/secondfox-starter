"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field, Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button, LinkButton } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { FlashMessage } from "@/components/ui/FlashMessage";
import { preventImplicitSubmit } from "@/lib/prevent-implicit-submit";
import type { FormState } from "@/lib/form-state";
import { deleteCustomer } from "./actions";

export type CustomerValues = {
  name: string;
  contact: string;
  email: string;
};

export function CustomerForm({
  action,
  initial,
  id,
  expectedUpdatedAt,
  canManage,
}: {
  action: (prev: FormState<CustomerValues>, formData: FormData) => Promise<FormState<CustomerValues>>;
  initial: CustomerValues;
  id?: string;
  expectedUpdatedAt?: string;
  canManage?: boolean;
}) {
  const [state, dispatch] = useActionState(action, { ok: true });

  const [name, setName] = useState(initial.name);
  const [contact, setContact] = useState(initial.contact);
  const [email, setEmail] = useState(initial.email);
  const [dirty, setDirty] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const fe = state.fieldErrors ?? {};

  // A-2: state.values から入力値を復元
  useEffect(() => {
    if (!state.ok && state.values) {
      const v = state.values;
      setName(v.name);
      setContact(v.contact);
      setEmail(v.email);
    }
  }, [state]);

  // A-2: 最初のエラーフィールドにフォーカス
  useEffect(() => {
    if (!state.ok) {
      const el = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']");
      el?.focus();
    }
  }, [state]);

  // A-2: 未保存の離脱ガード
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

        <Field label="会社名" htmlFor="name" required error={fe.name}>
          <Input
            id="name"
            name="name"
            value={name}
            onChange={(e) => { setName(e.target.value); mark(); }}
            maxLength={100}
            placeholder="例：株式会社○○商事"
            required
            aria-invalid={fe.name ? true : undefined}
            aria-describedby={fe.name ? "err-name" : undefined}
          />
        </Field>

        <Field label="担当者" htmlFor="contact" error={fe.contact}>
          <Input
            id="contact"
            name="contact"
            value={contact}
            onChange={(e) => { setContact(e.target.value); mark(); }}
            placeholder="例：山田 太郎"
            aria-invalid={fe.contact ? true : undefined}
            aria-describedby={fe.contact ? "err-contact" : undefined}
          />
        </Field>

        <Field label="メール" htmlFor="email" error={fe.email}>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); mark(); }}
            placeholder="例：yamada@example.com"
            aria-invalid={fe.email ? true : undefined}
            aria-describedby={fe.email ? "err-email" : undefined}
          />
        </Field>

        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <SubmitButton pendingLabel="保存中…">{id ? "更新する" : "登録する"}</SubmitButton>
          <LinkButton href="/master" variant="ghost">一覧へ戻る</LinkButton>
        </div>
      </form>

      {id && canManage && (
        <aside className="h-fit rounded-md border border-line bg-surface p-5">
          <div className="mb-3 text-[10px] uppercase tracking-[0.14em] text-muted">操作</div>
          <ConfirmModal
            trigger={<Button type="button" variant="danger" className="w-full">削除する</Button>}
            title="この顧客を削除しますか？"
            description="削除すると元に戻せません。案件で使われている顧客は削除できません。"
            confirmLabel="削除する"
            onConfirm={() => deleteCustomer(id)}
          />
        </aside>
      )}
    </div>
  );
}
