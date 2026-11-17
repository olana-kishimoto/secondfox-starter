"use client";

type Props = {
  label?: string;
  className?: string;
};

export function PrintButton({ label = "印刷する", className }: Props) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={
        className ??
        "no-print h-8 inline-flex items-center rounded bg-accent px-4 text-[12px] font-medium text-white hover:bg-accent-2 active:scale-[0.97]"
      }
    >
      {label}
    </button>
  );
}
