"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";

interface MonthFieldProps {
  name?: string;
  value: string; // YYYY-MM
  monthsBack?: number;
  monthsForward?: number;
  required?: boolean;
}

function shiftMonth(yyyyMm: string, delta: number): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-").map(Number);
  return `${y}年${String(m).padStart(2, "0")}月`;
}

export function MonthField({
  name = "month",
  value,
  monthsBack = 36,
  monthsForward = 3,
  required = true,
}: MonthFieldProps) {
  const [current, setCurrent] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const base = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const rangeStart = shiftMonth(base, -monthsBack);
  const rangeEnd = shiftMonth(base, monthsForward);

  const options: string[] = [];
  let m = rangeStart;
  while (m <= rangeEnd) {
    options.push(m);
    m = shiftMonth(m, 1);
  }
  if (!options.includes(current)) {
    options.push(current);
    options.sort();
  }

  function go(month: string) {
    const form = containerRef.current?.closest("form");
    if (!form) return;
    flushSync(() => setCurrent(month));
    form.requestSubmit();
  }

  return (
    <div ref={containerRef} className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => go(shiftMonth(current, -1))}
        className="rounded border border-line bg-surface px-2 py-[7px] text-[12px] text-text hover:bg-base"
      >
        ← 前月
      </button>
      <select
        name={name}
        value={current}
        required={required}
        onChange={(e) => {
          const v = e.currentTarget.value;
          const form = e.currentTarget.closest("form");
          flushSync(() => setCurrent(v));
          form?.requestSubmit();
        }}
        className="rounded border border-line bg-surface px-3 py-[7px] text-[13px] tabular-nums focus:border-accent focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>{monthLabel(o)}</option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => go(shiftMonth(current, 1))}
        className="rounded border border-line bg-surface px-2 py-[7px] text-[12px] text-text hover:bg-base"
      >
        翌月 →
      </button>
    </div>
  );
}
