"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Vòng quay" },
  { href: "/journal", label: "Nhật ký" },
  { href: "/prediction", label: "Dự đoán" },
  { href: "/chat", label: "Chatbot" },
  { href: "/settings", label: "Cài đặt" },
] as const;

export function Nav() {
  const pathname = usePathname();

  return (
    // "Khung ngoài" (outer web chrome): always the fixed light background/foreground
    // pair now, never the theme's own `surface` — previously used `bg-surface/80`,
    // which meant picking a dark theme also darkened the nav bar. `background`/
    // `foreground` no longer vary by theme at all (see theme.ts), so this reads as
    // "always light chrome" for every one of the 19 themes.
    <nav className="border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-1 px-4 py-3 sm:gap-4">
        <span className="mr-2 text-sm font-semibold tracking-tight text-foreground sm:mr-6">IELTS Practice</span>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive ? "bg-primary text-primary-foreground" : "text-foreground/70 hover:bg-primary/10 hover:text-foreground"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
