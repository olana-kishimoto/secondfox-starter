import type { InputHTMLAttributes } from "react";

/**
 * type="date" の薄いラッパー。
 * デフォルトで min="2000-01-01" max="9999-12-31" を設定し、年6桁入力を構造的に防ぐ。
 * className・min・max はすべて上書き可能。
 */
interface DateFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  className?: string;
}

export function DateField({
  min = "2000-01-01",
  max = "9999-12-31",
  className = "w-full rounded border border-line bg-surface px-3 py-[7px] text-[12px] text-text focus:border-accent focus:outline-none",
  ...props
}: DateFieldProps) {
  // type="date" はブラウザやツールが属性（style など）を足すことがあり、SSR とずれて dev で警告が出る。
  // 値そのものは SSR とクライアントで同じ（defaultValue）なので、この要素の属性差だけ許す。
  return <input type="date" min={min} max={max} className={className} suppressHydrationWarning {...props} />;
}
