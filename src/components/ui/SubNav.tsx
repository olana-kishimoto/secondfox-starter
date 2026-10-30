"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type SubNavItem = { label: string; href: string };

export function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();

  const activeHref = (() => {
    const matches = items
      .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
      .map((item) => item.href);
    if (!matches.length) return null;
    return matches.reduce((a, b) => (b.length > a.length ? b : a));
  })();

  return (
    <nav className="mb-5 -mx-4 md:-mx-8 px-4 md:px-8 flex border-b border-line">
      {items.map(({ label, href }) => {
        const active = href === activeHref;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative shrink-0 pb-2.5 pt-1 px-3 text-[12px] tracking-[0.04em] transition",
              active
                ? "font-medium text-accent after:absolute after:inset-x-0 after:bottom-[-1px] after:h-[2px] after:bg-accent"
                : "text-muted hover:text-text",
            )}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
