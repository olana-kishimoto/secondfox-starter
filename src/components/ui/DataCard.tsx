import Link from "next/link";
import { cn } from "@/lib/cn";

export function DataCard({
  href,
  children,
  className,
}: {
  href?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const cls = cn(
    "block rounded-md border border-line bg-surface px-4 py-3 transition",
    href && "hover:border-accent active:bg-base/40",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return <div className={cls}>{children}</div>;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="num font-mono text-[10.5px] tracking-[0.06em] text-accent">
      {children}
    </span>
  );
}

function Header({
  children,
  right,
}: {
  children?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">{children}</div>
      {right && <div className="flex shrink-0 items-center gap-1.5">{right}</div>}
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[14px] font-medium leading-[1.4] text-text">
      {children}
    </div>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-[12px] text-muted">{children}</div>;
}

function MetaRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-line pt-2.5">
      {children}
    </div>
  );
}

function Meta({
  label,
  value,
  mono,
  align,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("text-[11.5px]", align === "right" && "text-right")}>
      <span className="text-muted">{label} </span>
      <span className={cn("text-text", mono && "num")}>{value}</span>
    </div>
  );
}

DataCard.Header = Header;
DataCard.Eyebrow = Eyebrow;
DataCard.Title = Title;
DataCard.Sub = Sub;
DataCard.MetaRow = MetaRow;
DataCard.Meta = Meta;
