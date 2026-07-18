import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { updateProfile, deleteProfile, disconnectProfile } from "@/lib/actions/profiles";
import { ConfirmSubmit } from "@/app/_components/ConfirmSubmit";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_state: "That connection link expired or was invalid. Try connecting again.",
  tiktok_denied: "TikTok connection was cancelled or denied.",
  tiktok_not_configured: "TikTok isn't configured on this deployment yet (missing API keys).",
  tiktok_token_exchange: "TikTok didn't accept the connection. Try again.",
  facebook_denied: "Facebook connection was cancelled or denied.",
  facebook_not_configured: "Facebook isn't configured on this deployment yet (missing API keys).",
  facebook_token_exchange: "Facebook didn't accept the connection. Try again.",
  facebook_no_pages: "No Facebook Pages found for that account. You need admin access to a Page.",
};

export default async function ProfileDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const profile = await db.profile.findUnique({ where: { id } });
  if (!profile) notFound();

  const posts = await db.post.findMany({
    where: { profileId: id },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    take: 20,
  });

  const errorKey = typeof sp.error === "string" ? sp.error : null;
  const connected = sp.connected === "1";
  const connectHref =
    profile.platform === "TIKTOK"
      ? `/api/auth/tiktok?profileId=${profile.id}`
      : `/api/auth/facebook?profileId=${profile.id}`;

  const boundUpdate = updateProfile.bind(null, profile.id);
  const boundDelete = deleteProfile.bind(null, profile.id);
  const boundDisconnect = disconnectProfile.bind(null, profile.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{profile.name}</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            {profile.platform} · {profile.niche}
          </p>
        </div>
        <Link
          href={`/posts/new?profileId=${profile.id}`}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          New post
        </Link>
      </div>

      {errorKey && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {ERROR_MESSAGES[errorKey] ?? "Something went wrong connecting the account."}
        </div>
      )}
      {connected && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          Connected successfully.
        </div>
      )}

      <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 font-medium">Account connection</h2>
        {profile.connected ? (
          <div className="flex items-center justify-between text-sm">
            <span>
              Connected as <span className="font-medium">{profile.accountName ?? "unknown"}</span>
            </span>
            <form action={boundDisconnect}>
              <button
                type="submit"
                className="rounded-md border border-black/15 px-3 py-1.5 text-sm dark:border-white/20"
              >
                Disconnect
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center justify-between text-sm">
            <span className="text-black/60 dark:text-white/60">Not connected yet.</span>
            <a
              href={connectHref}
              className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-black"
            >
              Connect {profile.platform === "TIKTOK" ? "TikTok" : "Facebook"}
            </a>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 font-medium">Brand kit</h2>
        <form action={boundUpdate} className="flex max-w-lg flex-col gap-4">
          <Field label="Name" name="name" defaultValue={profile.name} required />
          <Field label="Niche" name="niche" defaultValue={profile.niche} required />
          <Field label="Brand tone" name="brandTone" defaultValue={profile.brandTone ?? ""} />
          <Field
            label="Brand hashtags (space-separated)"
            name="brandHashtags"
            defaultValue={profile.brandHashtags.join(" ")}
          />
          <Field
            label="Brand colors (comma-separated hex codes)"
            name="brandColors"
            defaultValue={profile.brandColors.join(", ")}
          />
          <Field label="Logo URL" name="logoUrl" defaultValue={profile.logoUrl ?? ""} />
          <button
            type="submit"
            className="mt-2 self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
          >
            Save brand kit
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-black/10 p-4 dark:border-white/10">
        <h2 className="mb-3 font-medium">Posts</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">No posts yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {posts.map((post) => (
              <li key={post.id} className="flex items-center justify-between text-sm">
                <span className="truncate pr-4">{post.caption}</span>
                <StatusBadge status={post.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-red-200 p-4 dark:border-red-900">
        <h2 className="mb-3 font-medium text-red-700 dark:text-red-400">Danger zone</h2>
        <form action={boundDelete}>
          <ConfirmSubmit
            label="Delete profile"
            confirmMessage={`Delete "${profile.name}" and all of its posts? This can't be undone.`}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-700 dark:border-red-900 dark:text-red-400"
          />
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
      />
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: "bg-black/5 dark:bg-white/10",
    SCHEDULED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
    PUBLISHING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
    PUBLISHED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
    FAILED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  };
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${colors[status] ?? ""}`}>
      {status}
    </span>
  );
}
