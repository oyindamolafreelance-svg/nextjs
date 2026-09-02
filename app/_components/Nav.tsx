import { getSessionUser } from "@/lib/auth";
import { NavClient, type NavLink } from "./NavClient";

export async function Nav() {
  const user = await getSessionUser();
  const approved = user?.profile.is_approved;
  const admin = user?.profile.is_admin;

  const links: NavLink[] = [];
  if (approved) {
    links.push(
      { href: "/jobs", label: "Jobs" },
      { href: "/post-job", label: "Post a job" },
      { href: "/my-posts", label: "My posts" },
      { href: "/saved", label: "Saved" },
      { href: "/progress", label: "Progress" },
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/settings", label: "Settings" }
    );
  }
  if (admin) {
    links.push(
      { href: "/admin/approvals", label: "Approvals" },
      { href: "/admin/sourced", label: "Sourced" },
      { href: "/admin/reports", label: "Reports" },
      { href: "/admin/analytics", label: "Analytics" },
      { href: "/admin/dashboard", label: "Dashboard" }
    );
  }

  return <NavClient links={links} signedIn={Boolean(user)} />;
}
