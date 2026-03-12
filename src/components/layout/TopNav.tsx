"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";

const tabs = [
  { href: "/", label: "Home", icon: Home },
  { href: "/cerca", label: "Cerca", icon: Search },
  { href: "/mappa", label: "Mappa", icon: Map },
] as const;

export function TopNav() {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile top bar — logo only */}
      <div className="sticky top-0 z-50 flex h-14 items-center justify-center glass-nav border-b border-white/15 lg:hidden">
        <Link href="/" className="flex items-center rounded focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <Logo className="h-12 w-auto" />
        </Link>
      </div>

      {/* Desktop nav — logo + tabs */}
      <nav className="hidden lg:block sticky top-0 z-50 glass-nav border-b border-white/15">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-8">
          <Link href="/" className="flex items-center rounded focus-visible:ring-[3px] focus-visible:ring-ring/50">
            <Logo className="h-14 w-auto" />
          </Link>

          <div className="flex items-center gap-1">
            {tabs.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;

              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    isActive
                      ? "text-primary font-medium bg-primary/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}
