import { cn } from "@/lib/cn";

const STYLES: Record<string, string> = {
  accent: "border-accent text-accent bg-accent-soft",
  ok: "border-ok/30 text-ok bg-ok-bg",
  warn: "border-warn/30 text-warn bg-warn-bg",
  muted: "border-line text-muted bg-base",
  bad: "border-bad/30 text-bad bg-bad-bg",
};

export function StatusBadge({
  label,
  color = "muted",
  className,
}: {
  label: string;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded border px-2 py-[2px]",
        "text-[10.5px] font-medium tracking-[0.14em]",
        STYLES[color] ?? STYLES.muted,
        className,
      )}
    >
      {label}
    </span>
  );
}
