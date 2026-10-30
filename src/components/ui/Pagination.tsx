"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

export function Pagination({ basePath, page, totalPages, total, pageSize }: {
  basePath: string; page: number; totalPages: number; total: number; pageSize: number;
}) {
  const sp = useSearchParams();
  const hrefFor = (p: number) => {
    const path = basePath.split("?")[0];
    const next = new URLSearchParams(sp);
    if (p <= 1) next.delete("page"); else next.set("page", String(p));
    const qs = next.toString();
    return qs ? `${path}?${qs}` : path;
  };
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const nums = new Set<number>();
  if (totalPages > 1) {
    nums.add(1); nums.add(totalPages);
    for (let p = page - 1; p <= page + 1; p++) if (p >= 1 && p <= totalPages) nums.add(p);
  }
  const sorted = [...nums].sort((a, b) => a - b);

  return (
    <nav aria-label="ページ送り"
      className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-line pt-4 md:flex-row">
      <p className="text-[11px] uppercase tracking-[0.14em] text-muted">
        <span className="num text-text">{from.toLocaleString()}</span>
        <span className="mx-0.5">–</span>
        <span className="num text-text">{to.toLocaleString()}</span>
        <span className="mx-1.5 text-line">|</span>
        全 <span className="num text-text">{total.toLocaleString()}</span> 件
      </p>

      <div className="flex items-center gap-1">
        <Btn href={hrefFor(1)} disabled={page <= 1} label="最初のページ" className="hidden sm:inline-flex">«</Btn>
        <Btn href={hrefFor(page - 1)} disabled={page <= 1} label="前のページ">‹ 前へ</Btn>
        {sorted.map((n, i) => {
          const gap = i > 0 && n - sorted[i - 1] > 1;
          return (
            <span key={n} className="flex items-center gap-1">
              {gap && <span className="px-0.5 text-[12px] text-muted" aria-hidden>…</span>}
              <Btn href={hrefFor(n)} active={n === page} label={`${n}ページ目`}>{n}</Btn>
            </span>
          );
        })}
        <Btn href={hrefFor(page + 1)} disabled={page >= totalPages} label="次のページ">次へ ›</Btn>
        <Btn href={hrefFor(totalPages)} disabled={page >= totalPages} label="最後のページ" className="hidden sm:inline-flex">»</Btn>
      </div>
    </nav>
  );
}

function Btn({ href, disabled, active, label, className, children }: {
  href: string; disabled?: boolean; active?: boolean; label?: string;
  className?: string; children: React.ReactNode;
}) {
  const cls = cn(
    "num inline-flex h-8 min-w-[32px] items-center justify-center rounded-[4px] border px-2.5 text-[12px] tracking-[0.04em] transition-colors",
    active
      ? "border-accent bg-accent text-white"
      : disabled
        ? "pointer-events-none border-line bg-base/40 text-muted opacity-40"
        : "border-line bg-surface text-text hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent-soft]",
    className,
  );
  if (disabled || active) return <span className={cls} aria-current={active ? "page" : undefined} aria-label={label}>{children}</span>;
  return <Link href={href} className={cls} aria-label={label}>{children}</Link>;
}
