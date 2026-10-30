"use client";

import { useState, useEffect, useRef } from "react";
import { IconSearch, IconX } from "@/components/icons";

export type SearchModalColumn = {
  key: string;
  label: string;
  className?: string;
};

// 単一選択モード: onSelect required
// 複数選択モード: multiple=true + onSelectMany required
type SearchModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  columns: SearchModalColumn[];
  rows: Record<string, unknown>[];
  searchPlaceholder?: string;
  onSearch: (q: string) => void;
  /** サーバー検索の応答待ちの間 true にすると「検索中…」を表示（古い結果や無関係な行を出さない） */
  loading?: boolean;
} & (
  | { multiple?: false | undefined; onSelect: (row: Record<string, unknown>) => void; onSelectMany?: never }
  | { multiple: true; onSelect?: never; onSelectMany: (rows: Record<string, unknown>[]) => void }
);

export function SearchModal({
  open,
  onClose,
  title,
  columns,
  rows,
  searchPlaceholder = "検索",
  onSearch,
  loading = false,
  onSelect,
  multiple,
  onSelectMany,
}: SearchModalProps) {
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setChecked(new Set());
      onSearch("");
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const rowKey = (row: Record<string, unknown>, i: number) =>
    String(row.id ?? i);

  const allChecked = rows.length > 0 && checked.size === rows.length;

  function toggleAll() {
    if (allChecked) {
      setChecked(new Set());
    } else {
      setChecked(new Set(rows.map((r, i) => rowKey(r, i))));
    }
  }

  function toggleRow(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleConfirmMany() {
    const selected = rows.filter((r, i) => checked.has(rowKey(r, i)));
    onSelectMany?.(selected);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-text/25" onClick={onClose} />
      <div className="relative flex w-full max-w-[640px] max-h-[76vh] flex-col rounded-md border border-line bg-surface shadow-2xl">

        {/* ヘッダー */}
        <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
          <span className="text-[11px] uppercase tracking-[0.2em] text-muted">{title}</span>
          <button type="button" onClick={onClose} className="text-muted hover:text-text">
            <IconX size={16} />
          </button>
        </div>

        {/* 検索 */}
        <div className="shrink-0 border-b border-line px-4 py-2.5">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => { setQ(e.target.value); onSearch(e.target.value); }}
              placeholder={searchPlaceholder}
              className="w-full rounded border border-line bg-base pl-8 pr-3 py-[7px] text-[13px] focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        {/* テーブル */}
        <div className="min-h-0 overflow-auto flex-1">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0">
              <tr className="border-b border-line bg-base text-[10px] uppercase tracking-[0.14em] text-muted">
                {multiple && (
                  <th className="w-8 px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      ref={(el) => { if (el) el.indeterminate = checked.size > 0 && !allChecked; }}
                      checked={allChecked}
                      onChange={toggleAll}
                      className="h-3.5 w-3.5 accent-accent cursor-pointer"
                      aria-label="全選択"
                    />
                  </th>
                )}
                {columns.map((c) => (
                  <th key={c.key} className={`px-4 py-2 text-left font-medium ${c.className ?? ""}`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length + (multiple ? 1 : 0)}
                    className="px-4 py-8 text-center text-muted"
                  >
                    検索中…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (multiple ? 1 : 0)}
                    className="px-4 py-8 text-center text-muted"
                  >
                    該当なし
                  </td>
                </tr>
              ) : rows.map((row, i) => {
                const key = rowKey(row, i);
                const isChecked = checked.has(key);
                return (
                  <tr
                    key={(row.id as string | number) ?? i}
                    className={`border-b border-line last:border-0 cursor-pointer ${
                      isChecked ? "bg-accent/5" : "hover:bg-base/60"
                    }`}
                    onClick={() => {
                      if (multiple) {
                        toggleRow(key);
                      } else {
                        onSelect?.(row);
                        onClose();
                      }
                    }}
                  >
                    {multiple && (
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRow(key)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5 accent-accent cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c.key} className={`px-4 py-2 ${c.className ?? ""}`}>
                        {String(row[c.key] ?? "")}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* フッター（複数選択モードのみ） */}
        {multiple && (
          <div className="shrink-0 flex items-center justify-between border-t border-line bg-base/50 px-4 py-2.5">
            <span className="text-[11px] text-muted">
              選択中 <span className="font-semibold text-text">{checked.size}</span> 件
            </span>
            <button
              type="button"
              disabled={checked.size === 0}
              onClick={handleConfirmMany}
              className="h-7 rounded bg-accent px-4 text-[12px] font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              追加
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
