"use client";

import { useState } from "react";

export function Tip({ text }: { text: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  return (
    <span
      className="relative ml-1 inline-flex"
      onMouseEnter={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setPos({ x: r.left + r.width / 2, y: r.bottom + 6 });
      }}
      onMouseLeave={() => setPos(null)}
    >
      <span className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-line text-[9px] text-muted hover:border-accent hover:text-accent transition-colors">
        ?
      </span>
      {pos && (
        <span
          style={{ position: "fixed", left: pos.x, top: pos.y, transform: "translateX(-50%)" }}
          className="z-[500] w-56 rounded border border-line bg-surface px-2.5 py-2 text-[11px] leading-relaxed text-text shadow-lg pointer-events-none"
        >
          {text}
        </span>
      )}
    </span>
  );
}
