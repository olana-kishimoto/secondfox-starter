// 白基調スケルトン（実コンテンツと同じ形）。olanaトークン準拠。
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-base ${className}`} />;
}

// 一覧テーブルの骨組み
export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      <div className="flex gap-4 border-b border-line bg-base/60 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-3 flex-1" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-line px-4 py-3 last:border-0">
          {Array.from({ length: cols }).map((_, c) => <Skeleton key={c} className="h-3.5 flex-1" />)}
        </div>
      ))}
    </div>
  );
}

// ページ共通：ヘッダ＋本文の骨組み
export function PageSkeleton({ variant = "table" }: { variant?: "table" | "detail" }) {
  return (
    <main className="px-4 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-6 w-48" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      {variant === "table" ? (
        <>
          <div className="mb-4 flex gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-20" />
          </div>
          <TableSkeleton />
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Skeleton className="h-40 w-full rounded-md" />
            <Skeleton className="h-64 w-full rounded-md" />
          </div>
          <Skeleton className="h-48 w-full rounded-md" />
        </div>
      )}
    </main>
  );
}
