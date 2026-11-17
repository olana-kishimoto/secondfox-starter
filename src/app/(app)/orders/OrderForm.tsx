"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { DateField } from "@/components/ui/DateField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Button, LinkButton } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { SearchModal } from "@/components/ui/SearchModal";
import { ORDER_STATUS } from "@/lib/labels";
import { foldIncludes } from "@/lib/fold-search";
import { preventImplicitSubmit } from "@/lib/prevent-implicit-submit";
import { formatYen } from "@/lib/format";
import { IconSearch, IconPlus } from "@/components/icons";
import { FlashMessage } from "@/components/ui/FlashMessage";
import type { FormState } from "@/lib/form-state";
import { deleteOrder, setOrderStatus } from "./actions";

export type CustomerOption = { id: string; name: string; contact: string | null };
export type ProductOption  = { id: string; code: string; name: string; unit_price: number };

export type OrderItemInput = {
  product_id: string;
  name: string;
  qty: number;
  unit_price: number;
};

export type OrderValues = {
  customer_id: string;
  order_date: string;
  status: string;
  memo: string;
  items: string; // JSON.stringify(OrderItemInput[])
};

const NEXT_STATUS: Record<string, string | undefined> = {
  draft:     "confirmed",
  confirmed: "shipped",
  shipped:   "done",
};
const NEXT_LABEL: Record<string, string> = {
  confirmed: "出荷済みにする",
  shipped:   "完了にする",
  done:      "完了",
};

function emptyItem(): OrderItemInput {
  return { product_id: "", name: "", qty: 1, unit_price: 0 };
}

export function OrderForm({
  action,
  customers,
  products,
  initial,
  id,
  currentStatus,
  expectedUpdatedAt,
  canEdit,
}: {
  action: (prev: FormState<OrderValues>, formData: FormData) => Promise<FormState<OrderValues>>;
  customers: CustomerOption[];
  products: ProductOption[];
  initial: OrderValues;
  id?: string;
  currentStatus?: string;
  expectedUpdatedAt?: string;
  canEdit: boolean;
}) {
  const [state, dispatch] = useActionState(action, { ok: true });

  const [customerId, setCustomerId] = useState(initial.customer_id);
  const [orderDate, setOrderDate]   = useState(initial.order_date);
  const [memo, setMemo]             = useState(initial.memo);
  const [dirty, setDirty]           = useState(false);

  // 明細（JSON で hidden input に載せる）
  const initialItems = (() => {
    try { return JSON.parse(initial.items || "[]") as OrderItemInput[]; } catch { return [emptyItem()]; }
  })();
  const [items, setItems] = useState<OrderItemInput[]>(
    initialItems.length > 0 ? initialItems : [emptyItem()]
  );

  // 商品ピッカー（行インデックス付き）
  const [pickerOpen, setPickerOpen]           = useState(false);
  const [pickerRowIdx, setPickerRowIdx]       = useState<number | null>(null);
  const [productHits, setProductHits]         = useState<ProductOption[]>(products);

  // 顧客ピッカー
  const [custPickerOpen, setCustPickerOpen]   = useState(false);
  const [custHits, setCustHits]               = useState<CustomerOption[]>(customers);

  const formRef = useRef<HTMLFormElement>(null);
  const customerName = customers.find((c) => c.id === customerId)?.name ?? "";
  const fe = state.fieldErrors ?? {};

  // 編集不可の状態（確定後は明細を編集不可にする）
  const itemsReadOnly = !canEdit || (currentStatus && currentStatus !== "draft");

  // A-2: Restore from state.values on error
  useEffect(() => {
    if (!state.ok && state.values) {
      const v = state.values;
      setCustomerId(v.customer_id);
      setOrderDate(v.order_date);
      setMemo(v.memo);
      try { const it = JSON.parse(v.items || "[]"); if (Array.isArray(it)) setItems(it); } catch { /* noop */ }
    }
  }, [state]);

  // A-2: Focus first error field
  useEffect(() => {
    if (!state.ok) {
      const el = formRef.current?.querySelector<HTMLElement>("[aria-invalid='true']");
      el?.focus();
    }
  }, [state]);

  // A-2: Leave guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const mark = () => setDirty(true);

  // 明細操作
  const updateItem = (i: number, patch: Partial<OrderItemInput>) => {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));
    mark();
  };
  const addItem = () => { setItems((prev) => [...prev, emptyItem()]); mark(); };
  const removeItem = (i: number) => { setItems((prev) => prev.filter((_, idx) => idx !== i)); mark(); };

  const totalAmount = items.reduce((s, it) => s + (it.qty || 0) * (it.unit_price || 0), 0);

  // 次の状態ボタン（draft→confirmed→shipped→done）
  const nextStatus = currentStatus ? NEXT_STATUS[currentStatus] : undefined;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      {state.formError && (
        <div className="lg:col-span-3"><FlashMessage error={state.formError} /></div>
      )}

      <form
        ref={formRef}
        action={dispatch}
        onKeyDown={preventImplicitSubmit}
        className="rounded-md border border-line bg-surface p-5 lg:col-span-2"
      >
        <input type="hidden" name="customer_id" value={customerId} />
        <input type="hidden" name="status" value={initial.status} />
        <input type="hidden" name="items" value={JSON.stringify(items)} />
        {expectedUpdatedAt && (
          <input type="hidden" name="expected_updated_at" value={expectedUpdatedAt} />
        )}

        <div className="grid grid-cols-1 gap-x-5 md:grid-cols-2">
          {/* 取引先 */}
          <Field label="取引先" htmlFor="customer_name" hint="検索ボタンから顧客マスタを選びます">
            <div className="flex gap-2">
              <Input
                id="customer_name"
                value={customerName}
                placeholder="未選択"
                readOnly
                onClick={() => canEdit && setCustPickerOpen(true)}
                className={canEdit ? "cursor-pointer" : ""}
              />
              {canEdit && (
                <>
                  <Button type="button" variant="ghost" onClick={() => setCustPickerOpen(true)} aria-label="取引先を検索">
                    <IconSearch size={14} />
                  </Button>
                  {customerId && (
                    <Button type="button" variant="ghost" onClick={() => { setCustomerId(""); mark(); }}>解除</Button>
                  )}
                </>
              )}
            </div>
          </Field>

          {/* 受注日 */}
          <Field label="受注日" htmlFor="order_date" required error={fe.order_date}>
            <DateField
              id="order_date"
              name="order_date"
              value={orderDate}
              onChange={(e) => { setOrderDate(e.target.value); mark(); }}
              className="w-full rounded border border-line bg-surface px-3 py-[7px] text-[13px] text-text focus:border-accent focus:outline-none focus:ring-[3px] focus:ring-accent-soft"
              disabled={!canEdit}
              aria-invalid={fe.order_date ? true : undefined}
              aria-describedby={fe.order_date ? "err-order_date" : undefined}
            />
          </Field>

          {/* メモ */}
          <div className="md:col-span-2">
            <Field label="メモ" htmlFor="memo" error={fe.memo}>
              <Textarea
                id="memo"
                name="memo"
                value={memo}
                onChange={(e) => { setMemo(e.target.value); mark(); }}
                maxLength={1000}
                rows={2}
                disabled={!canEdit}
              />
            </Field>
          </div>
        </div>

        {/* 明細テーブル */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted">明細</span>
            {!itemsReadOnly && (
              <Button type="button" variant="ghost" onClick={addItem}>
                <IconPlus size={12} />行を追加
              </Button>
            )}
          </div>
          {fe.items && (
            <p className="mb-2 text-[12px] text-red-600" id="err-items" role="alert">{fe.items}</p>
          )}
          <div className="overflow-x-auto rounded-md border border-line">
            <table className="master-table w-full">
              <thead>
                <tr className="bg-base text-[10px] uppercase tracking-[0.14em] text-muted">
                  <th className="text-left">品名</th>
                  <th className="text-right">数量</th>
                  <th className="text-right">単価</th>
                  <th className="text-right">金額</th>
                  {!itemsReadOnly && <th className="w-10"></th>}
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i}>
                    <td data-label="品名">
                      <div className="flex items-center gap-1">
                        {!itemsReadOnly && (
                          <Button
                            type="button"
                            variant="ghost"
                            aria-label="商品を選択"
                            onClick={() => { setPickerRowIdx(i); setProductHits(products); setPickerOpen(true); }}
                          >
                            <IconSearch size={12} />
                          </Button>
                        )}
                        {itemsReadOnly ? (
                          <span className="text-[13px]">{it.name}</span>
                        ) : (
                          <Input
                            value={it.name}
                            onChange={(e) => updateItem(i, { name: e.target.value })}
                            placeholder="品名を入力"
                            aria-label={`品名 ${i + 1}`}
                            aria-invalid={fe.items ? true : undefined}
                            aria-describedby={fe.items ? "err-items" : undefined}
                          />
                        )}
                      </div>
                    </td>
                    <td data-label="数量" className="text-right">
                      {itemsReadOnly ? (
                        <span className="num text-[13px]">{it.qty.toLocaleString("ja-JP")}</span>
                      ) : (
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          step={1}
                          value={it.qty}
                          onChange={(e) => updateItem(i, { qty: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                          className="num w-24 text-right"
                          aria-label={`数量 ${i + 1}`}
                        />
                      )}
                    </td>
                    <td data-label="単価" className="text-right">
                      {itemsReadOnly ? (
                        <span className="num text-[13px]">{it.unit_price.toLocaleString("ja-JP")}</span>
                      ) : (
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={it.unit_price}
                          onChange={(e) => updateItem(i, { unit_price: Math.max(0, Math.round(Number(e.target.value) || 0)) })}
                          className="num w-32 text-right"
                          aria-label={`単価 ${i + 1}`}
                        />
                      )}
                    </td>
                    <td data-label="金額" className="num text-right font-medium">
                      {formatYen(it.qty * it.unit_price)}
                    </td>
                    {!itemsReadOnly && (
                      <td>
                        {items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => removeItem(i)}
                            aria-label={`行 ${i + 1} を削除`}
                          >
                            ×
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-base/60 font-medium">
                  <td colSpan={!itemsReadOnly ? 3 : 3} className="px-4 py-2 text-right text-[12px] text-muted">合計</td>
                  <td className="num px-4 py-2 text-right">{formatYen(totalAmount)}</td>
                  {!itemsReadOnly && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {canEdit && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <SubmitButton pendingLabel="保存中…">{id ? "更新する" : "登録する"}</SubmitButton>
            <LinkButton href="/orders" variant="ghost">一覧へ戻る</LinkButton>
          </div>
        )}
        {!canEdit && (
          <div className="mt-4 border-t border-line pt-4">
            <LinkButton href="/orders" variant="ghost">一覧へ戻る</LinkButton>
          </div>
        )}
      </form>

      {/* 操作パネル */}
      <aside className="h-fit rounded-md border border-line bg-surface p-5">
        {id && canEdit ? (
          <>
            <div className="mb-3 text-[10px] uppercase tracking-[0.14em] text-muted">操作</div>
            <div className="flex flex-col gap-2">
              {nextStatus && (
                <ConfirmModal
                  trigger={<Button type="button" variant="primary" className="w-full">
                    {nextStatus === "confirmed" ? "受注確定する" : NEXT_LABEL[nextStatus] ?? nextStatus}
                  </Button>}
                  title={`状態を変更しますか？`}
                  description={`「${ORDER_STATUS[nextStatus]?.label}」に変更します。`}
                  confirmLabel="変更する"
                  variant="primary"
                  onConfirm={() => setOrderStatus(id, nextStatus)}
                />
              )}
              {currentStatus !== "canceled" && currentStatus !== "done" && (
                <ConfirmModal
                  trigger={<Button type="button" variant="ghost" className="w-full">中止する</Button>}
                  title="この受注を中止しますか？"
                  description="状態が「中止」に変わります。"
                  confirmLabel="中止する"
                  onConfirm={() => setOrderStatus(id, "canceled")}
                />
              )}
              <ConfirmModal
                trigger={<Button type="button" variant="danger" className="w-full">削除する</Button>}
                title="この受注を削除しますか？"
                description="削除すると元に戻せません。"
                confirmLabel="削除する"
                onConfirm={() => deleteOrder(id)}
              />
            </div>
          </>
        ) : id ? (
          <div className="text-[12px] leading-[1.9] text-muted">
            <div className="mb-2 text-[10px] uppercase tracking-[0.14em]">閲覧のみ</div>
            この受注を編集・削除するには編集以上の権限が必要です。
          </div>
        ) : (
          <div className="text-[12px] leading-[1.9] text-muted">
            <div className="mb-2 text-[10px] uppercase tracking-[0.14em]">入力のしかた</div>
            取引先・受注日を設定し、明細を1行以上入力して登録します。受注番号は自動で付きます。
          </div>
        )}
      </aside>

      {/* 顧客ピッカー */}
      <SearchModal
        open={custPickerOpen}
        onClose={() => setCustPickerOpen(false)}
        title="取引先を選ぶ"
        searchPlaceholder="会社名・担当者で検索"
        columns={[{ key: "name", label: "会社名" }, { key: "contact", label: "担当者" }]}
        rows={custHits as unknown as Record<string, unknown>[]}
        onSearch={(q) => setCustHits(customers.filter((c) => foldIncludes(c.name, q) || foldIncludes(c.contact, q)))}
        onSelect={(row) => { setCustomerId(String(row.id)); setCustPickerOpen(false); mark(); }}
      />

      {/* 商品ピッカー */}
      <SearchModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="商品を選ぶ"
        searchPlaceholder="商品名・コードで検索"
        columns={[{ key: "code", label: "コード" }, { key: "name", label: "商品名" }, { key: "unit_price", label: "単価" }]}
        rows={productHits as unknown as Record<string, unknown>[]}
        onSearch={(q) => setProductHits(products.filter((p) => foldIncludes(p.name, q) || foldIncludes(p.code, q)))}
        onSelect={(row) => {
          if (pickerRowIdx !== null) {
            updateItem(pickerRowIdx, {
              product_id: String(row.id),
              name: String(row.name),
              unit_price: Number(row.unit_price),
            });
          }
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
