// Tier ladder — kept in step with the thresholds in migration 0008_tiers.sql.
// Used for display (progress page, badges); the authoritative tier for a user
// is computed in the database via my_progress() / user_tier().

export interface TierDef {
  name: string;
  minPosts: number;
  minActiveDays: number;
  minClicks: number;
  quota: number; // daily posts needed to unlock browsing (0 = permanent)
  perk: string;
  emoji: string;
}

export const TIERS: TierDef[] = [
  {
    name: "Newcomer",
    minPosts: 0,
    minActiveDays: 0,
    minClicks: 0,
    quota: 5,
    perk: "Post 5 a day to unlock browsing",
    emoji: "🌱",
  },
  {
    name: "Contributor",
    minPosts: 25,
    minActiveDays: 5,
    minClicks: 10,
    quota: 4,
    perk: "Badge · daily unlock eases to 4",
    emoji: "🔹",
  },
  {
    name: "Trusted",
    minPosts: 100,
    minActiveDays: 20,
    minClicks: 40,
    quota: 3,
    perk: "Trusted badge · daily unlock eases to 3",
    emoji: "⭐",
  },
  {
    name: "Veteran",
    minPosts: 300,
    minActiveDays: 60,
    minClicks: 120,
    quota: 2,
    perk: "Daily unlock eases to 2",
    emoji: "🏅",
  },
  {
    name: "Ambassador",
    minPosts: 750,
    minActiveDays: 150,
    minClicks: 300,
    quota: 0,
    perk: "Permanent browse access · top badge",
    emoji: "👑",
  },
];

export function tierByName(name: string): TierDef {
  return TIERS.find((t) => t.name === name) ?? TIERS[0];
}

export function tierIndex(name: string): number {
  const i = TIERS.findIndex((t) => t.name === name);
  return i === -1 ? 0 : i;
}
