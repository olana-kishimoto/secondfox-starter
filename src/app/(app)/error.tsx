"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-muted">Error</div>
      <h1 className="mb-2 text-[18px] font-semibold text-text">問題が発生しました</h1>
      <p className="mb-6 max-w-md text-[13px] text-muted">
        処理中にエラーが発生しました。再試行しても解決しない場合は管理者にお問い合わせください。
      </p>
      <div className="flex gap-3">
        <button onClick={reset}
          className="h-9 inline-flex items-center rounded bg-accent px-4 text-[12px] font-medium text-white transition active:scale-[0.97] hover:bg-accent-2">
          再試行
        </button>
        <Link href="/"
          className="h-9 inline-flex items-center rounded border border-line px-4 text-[12px] text-text transition active:scale-[0.97] hover:border-accent hover:text-accent">
          ホームへ
        </Link>
      </div>
    </main>
  );
}
