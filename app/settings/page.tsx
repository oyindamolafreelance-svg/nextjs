import { headers } from "next/headers";
import { requireApproved } from "@/lib/auth";
import { ClipToken } from "./ClipToken";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireApproved("/settings");

  // Best-effort site URL for the extension config.
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const host = (await headers()).get("host");
  const siteUrl = configured || (host ? `https://${host}` : "");

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Signed in as {user.email}.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-medium">Clip-to-board extension</h2>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Install the browser extension, then paste your site URL and clip
            token into it. When you&apos;re viewing a job on ProZ, LinkedIn, or
            anywhere, click the extension to send it to your board (it lands in
            the Sourced review queue).
          </p>
        </div>
        <ClipToken token={user.profile.clip_token} siteUrl={siteUrl} />
      </section>

      <section className="rounded-lg border border-black/10 p-4 text-sm text-black/70 dark:border-white/10 dark:text-white/70">
        <p className="mb-2 font-medium">How to install the extension</p>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Download the <code>extension</code> folder from the project repo.</li>
          <li>
            In Chrome/Edge, open <code>chrome://extensions</code>, turn on
            <strong> Developer mode</strong>, click <strong>Load unpacked</strong>,
            and select that folder.
          </li>
          <li>Open the extension, paste your <strong>Site URL</strong> and <strong>clip token</strong> above, Save.</li>
          <li>Visit a job page and click the extension → <strong>Send to board</strong>.</li>
        </ol>
      </section>
    </div>
  );
}
