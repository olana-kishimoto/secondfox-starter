"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "./Button";

export function ConfirmModal({
  trigger,
  title,
  description,
  confirmLabel = "削除",
  cancelLabel = "キャンセル",
  variant = "danger",
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  onConfirm: () => Promise<void> | void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const close = () => setOpen(false);

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        className="m-auto rounded-md border border-line bg-surface p-0 text-text shadow-none backdrop:bg-[rgba(69,69,69,0.32)]"
      >
        <div className="w-[420px] max-w-[92vw] px-6 py-6">
          <h2 className="mb-2 text-[15px] font-semibold tracking-[0.08em] text-text">
            {title}
          </h2>
          {description && (
            <p className="mb-5 text-[12.5px] leading-[1.9] text-muted">
              {description}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={close} disabled={isPending}>
              {cancelLabel}
            </Button>
            <Button
              type="button"
              variant={variant}
              size="sm"
              loading={isPending}
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await onConfirm();
                  close();
                })
              }
            >
              {isPending ? "処理中…" : confirmLabel}
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
