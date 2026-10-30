"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { saveSearchTemplate, deleteSearchTemplate, type SearchTemplate } from "@/lib/search-templates/actions";

/** 保存対象から除外する searchParams キー（ページ番号・通知など一時値） */
const EXCLUDE_KEYS = new Set(["page", "msg", "error"]);

type Props = {
  screenKey: string;
  templates: SearchTemplate[];
};

/**
 * 一覧検索条件の個人テンプレート保存・適用・削除コンポーネント。
 * 各一覧ページの検索フォームの近くに配置する。
 * テンプレート一覧と「現在の条件を保存」UIを提供する。
 */
export function SearchTemplates({ screenKey, templates }: Props) {
  const router = useRouter();
  const sp = useSearchParams();

  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // 現在の URL から保存対象外キーを除いたフィルタ文字列を生成
  const buildSaveParams = (): string => {
    const next = new URLSearchParams();
    sp.forEach((value, key) => {
      if (!EXCLUDE_KEYS.has(key) && value !== "") next.set(key, value);
    });
    return next.toString();
  };

  // テンプレート適用 → URL 書き換え
  const apply = (params: string) => {
    router.push(`?${params}`);
  };

  // テンプレート保存
  const handleSave = () => {
    if (!saveName.trim()) {
      setSaveError("名前を入力してください");
      inputRef.current?.focus();
      return;
    }
    setSaveError("");
    startTransition(async () => {
      const res = await saveSearchTemplate(screenKey, saveName.trim(), buildSaveParams());
      if (res.error) {
        setSaveError(res.error);
        return;
      }
      setSaveName("");
      setShowSave(false);
      router.refresh();
    });
  };

  // テンプレート削除（連打ガード: deletingId で制御）
  const handleDelete = (id: number) => {
    if (deletingId !== null) return;
    setDeletingId(id);
    startTransition(async () => {
      await deleteSearchTemplate(id);
      setDeletingId(null);
      router.refresh();
    });
  };

  // Enterキーで保存
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); handleSave(); }
    if (e.key === "Escape") { setShowSave(false); setSaveName(""); setSaveError(""); }
  };

  const hasTemplates = templates.length > 0;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      {/* ラベル */}
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted shrink-0">
        保存条件
      </span>

      {/* テンプレートチップ一覧 */}
      {hasTemplates ? (
        <div className="flex flex-wrap gap-1.5">
          {templates.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-0 rounded border border-line bg-base text-[11px]"
            >
              <button
                type="button"
                onClick={() => apply(t.params)}
                className="px-2.5 py-1 text-text hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-l"
                title={`この条件を適用: ${t.name}`}
              >
                {t.name}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                disabled={deletingId === t.id || isPending}
                className="px-1.5 py-1 text-muted hover:text-bad focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-r disabled:opacity-40"
                aria-label={`「${t.name}」を削除`}
                title="削除"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <span className="text-[11px] text-muted italic">（なし）</span>
      )}

      {/* 保存UIのトグル */}
      {!showSave ? (
        <button
          type="button"
          onClick={() => { setShowSave(true); setSaveError(""); setTimeout(() => inputRef.current?.focus(), 50); }}
          className="ml-auto shrink-0 h-7 inline-flex items-center rounded border border-line px-2.5 text-[11px] text-muted hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          + 現在の条件を保存
        </button>
      ) : (
        <div className="ml-auto shrink-0 flex items-center gap-1.5">
          <div className="flex flex-col">
            <input
              ref={inputRef}
              type="text"
              value={saveName}
              onChange={(e) => { setSaveName(e.target.value); setSaveError(""); }}
              onKeyDown={onKeyDown}
              placeholder="テンプレート名（最大50文字）"
              maxLength={50}
              className="h-7 w-44 rounded border border-line bg-surface px-2 text-[12px] focus:border-accent focus:outline-none"
              aria-label="テンプレート名"
            />
            {saveError && (
              <p className="mt-0.5 text-[10px] text-bad">{saveError}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="h-7 inline-flex items-center rounded bg-accent px-3 text-[11px] font-medium text-white hover:bg-accent/90 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {isPending ? "保存中…" : "保存"}
          </button>
          <button
            type="button"
            onClick={() => { setShowSave(false); setSaveName(""); setSaveError(""); }}
            className="h-7 inline-flex items-center rounded border border-line px-2 text-[11px] text-muted hover:border-line hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            キャンセル
          </button>
        </div>
      )}
    </div>
  );
}
