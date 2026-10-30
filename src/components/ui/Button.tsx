import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "danger";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-semibold tracking-[0.16em] " +
  "transition-[transform,background-color,border-color,color,opacity] duration-100 " +
  "active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none";

const sizes: Record<Size, string> = {
  md: "h-9 px-4 text-[12px]",
  sm: "h-8 px-3 text-[11.5px]",
};

const variants: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-2 active:bg-accent-2 active:scale-[0.98]",
  ghost:
    "border border-line bg-surface text-text hover:border-accent hover:text-accent active:bg-base",
  danger:
    "border border-line bg-surface text-bad hover:border-bad active:bg-bad-bg",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  loading,
  disabled,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      {...rest}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={cn(base, sizes[size], variants[variant], className)}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  href = "#",
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  size?: Size;
}) {
  // 内部遷移は next/link で SPA 遷移＋prefetch
  return (
    <Link
      href={href}
      {...rest}
      className={cn(base, sizes[size], variants[variant], className)}
    />
  );
}

function Spinner() {
  return (
    <span
      className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
      aria-hidden
    />
  );
}
