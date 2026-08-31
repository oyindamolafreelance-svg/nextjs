"use client";

// Renders the apply target (email/URL/plain) and logs an "apply" click for
// admin analytics before the browser follows the link. Best-effort logging —
// navigation is never blocked if the log call fails.
export function ApplyLink({ jobId, contact }: { jobId: string; contact: string }) {
  const trimmed = contact.trim();
  const isUrl = /^https?:\/\//i.test(trimmed);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);

  function log() {
    try {
      const body = JSON.stringify({});
      // keepalive lets the request survive the navigation that follows.
      fetch(`/api/jobs/${jobId}/click`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch {
      // ignore — never block the user from applying
    }
  }

  if (isUrl || isEmail) {
    return (
      <a
        href={isEmail ? `mailto:${trimmed}` : trimmed}
        target={isUrl ? "_blank" : undefined}
        rel={isUrl ? "noopener noreferrer" : undefined}
        onClick={log}
        onAuxClick={log}
        className="font-medium text-blue-700 underline dark:text-blue-400"
      >
        {trimmed}
      </a>
    );
  }
  return <span className="font-medium">{trimmed}</span>;
}
