"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/actions/auth";

export interface NavLink {
  href: string;
  label: string;
}

export function NavClient({
  links,
  signedIn,
}: {
  links: NavLink[];
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-20 border-b divider bg-[color:var(--surface)]/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[color:var(--brand)] text-sm text-white">
            L
          </span>
          <span>LinguaBoard</span>
        </Link>

        {/* Desktop nav */}
        <nav className="ml-2 hidden flex-1 flex-wrap gap-1 text-sm md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                "rounded-lg px-3 py-1.5 transition-colors " +
                (isActive(l.href)
                  ? "bg-[color:var(--brand-weak)] text-[color:var(--brand)]"
                  : "muted hover:text-[color:var(--fg)]")
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {signedIn ? (
            <form action={logoutAction}>
              <button type="submit" className="btn btn-secondary">
                Sign out
              </button>
            </form>
          ) : (
            <>
              <Link href="/login" className="btn btn-secondary">
                Log in
              </Link>
              <Link href="/register" className="btn btn-primary">
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="ml-auto grid h-9 w-9 place-items-center rounded-lg border divider md:hidden"
          aria-label="Menu"
          aria-expanded={open}
        >
          <span className="text-lg leading-none">{open ? "✕" : "☰"}</span>
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t divider px-5 py-3 md:hidden">
          <nav className="flex flex-col gap-1 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={
                  "rounded-lg px-3 py-2 " +
                  (isActive(l.href)
                    ? "bg-[color:var(--brand-weak)] text-[color:var(--brand)]"
                    : "muted")
                }
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex gap-2">
              {signedIn ? (
                <form action={logoutAction} className="flex-1">
                  <button type="submit" className="btn btn-secondary w-full">
                    Sign out
                  </button>
                </form>
              ) : (
                <>
                  <Link href="/login" className="btn btn-secondary flex-1" onClick={() => setOpen(false)}>
                    Log in
                  </Link>
                  <Link href="/register" className="btn btn-primary flex-1" onClick={() => setOpen(false)}>
                    Register
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
