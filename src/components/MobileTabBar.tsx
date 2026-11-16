"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TAB_MENU, menuMatchLength } from "@/lib/menu";
import { cn } from "@/lib/cn";
import { can, type Perms } from "@/lib/can";

export function MobileTabBar({ perms }: { perms?: Perms }) {
  const pathname = usePathname();
  const menu = TAB_MENU.filter((m) => !m.feature || can(perms ?? {}, m.feature, m.minLevel ?? "view"));

  return (
    <nav
      className={cn(
        "md:hidden",
        "fixed inset-x-0 bottom-0 z-40",
        "border-t border-line bg-surface",
        "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      <ul className="flex">
        {menu.map(({ key, label, href, icon: Icon, also }) => {
          const best = Math.max(...menu.map((m) => menuMatchLength(m, pathname)));
          const active = best > 0 && menuMatchLength({ key, label, href, icon: Icon, also }, pathname) === best;
          return (
            <li key={key} className="flex-1">
              <Link
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2",
                  "text-[10px] tracking-[0.06em]",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
