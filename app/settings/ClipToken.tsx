"use client";

import { useState } from "react";
import { generateClipToken } from "@/lib/actions/settings";

export function ClipToken({ token, siteUrl }: { token: string | null; siteUrl: string }) {
  const [copied, setCopied] = useState<"" | "token" | "url">("");

  async function copy(text: string, which: "token" | "url") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {token ? (
        <>
          <Field label="Your clip token" value={token} onCopy={() => copy(token, "token")} copied={copied === "token"} mono />
          <Field label="Your site URL" value={siteUrl} onCopy={() => copy(siteUrl, "url")} copied={copied === "url"} />
        </>
      ) : (
        <p className="text-sm text-black/60 dark:text-white/60">
          You don&apos;t have a clip token yet. Generate one, then paste it into
          the extension.
        </p>
      )}

      <form action={generateClipToken}>
        <button
          type="submit"
          className="rounded-md border border-black/20 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/25 dark:hover:bg-white/10"
        >
          {token ? "Regenerate token" : "Generate clip token"}
        </button>
      </form>
      {token && (
        <p className="text-xs text-black/50 dark:text-white/50">
          Regenerating invalidates the old token — you&apos;ll need to update the
          extension.
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onCopy,
  copied,
  mono,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  copied: boolean;
  mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className={
            "flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20 " +
            (mono ? "font-mono text-xs" : "")
          }
        />
        <button
          type="button"
          onClick={onCopy}
          className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </label>
  );
}
