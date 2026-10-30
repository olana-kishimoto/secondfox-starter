import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted">404</div>
      <h1 className="mb-2 text-[18px] font-semibold text-text">ページが見つかりません</h1>
      <p className="mb-6 max-w-md text-[13px] text-muted">お探しのページは存在しないか、移動・削除された可能性があります。</p>
      <Link href="/"
        className="h-9 inline-flex items-center rounded bg-accent px-4 text-[12px] font-medium text-white transition active:scale-[0.97] hover:bg-accent-2">
        ホームへ戻る
      </Link>
    </main>
  );
}
