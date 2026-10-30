/**
 * 大文字小文字・全角半角を区別しない検索用の正規化関数。
 * NFKC 正規化により：半角カナ→全角カナ、全角英数→半角英数 に統一。
 * toLowerCase() で大小を統一。
 * 検索語と対象の両方に適用して比較する。
 */
export function foldSearch(s: string | null | undefined): string {
  return (s ?? "").normalize("NFKC").toLowerCase();
}

/** s が query を含むか（両辺を foldSearch で正規化して比較） */
export function foldIncludes(s: string | null | undefined, query: string): boolean {
  if (!query) return true;
  return foldSearch(s).includes(foldSearch(query));
}
