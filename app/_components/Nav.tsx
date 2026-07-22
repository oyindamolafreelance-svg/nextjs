import Link from "next/link";
import { logout } from "@/lib/actions/auth";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/profiles", label: "Profiles" },
  { href: "/posts", label: "Posts" },
];

export function Nav() {
  return (
    <header className="border-b border-black/10 dark:border-white/10">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
        <span className="font-semibold tracking-tight">Autopost</span>
        <nav className="flex flex-1 gap-4 text-sm text-black/70 dark:text-white/70">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-current">
              {link.label}
            </Link>
          ))}
        </nav>
        {process.env.APP_PASSWORD && (
          <form action={logout}>
            <button type="submit" className="text-sm text-black/50 hover:text-current dark:text-white/50">
              Sign out
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
