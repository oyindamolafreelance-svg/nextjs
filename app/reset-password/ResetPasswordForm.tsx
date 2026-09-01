"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PasswordInput } from "@/app/_components/PasswordInput";

const supabase = createClient();

export function ResetPasswordForm() {
  const router = useRouter();
  // "checking" until we know whether a recovery session is present.
  const [ready, setReady] = useState<"checking" | "ok" | "missing">("checking");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    // supabase-js reads the recovery token from the URL automatically and
    // fires PASSWORD_RECOVERY. Also check for an already-established session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady("ok");
    });
    supabase.auth.getSession().then(({ data }) => {
      setReady((r) => (data.session ? "ok" : r === "checking" ? "missing" : r));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setStatus("saving");
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setError(error.message);
    } else {
      setStatus("done");
      setTimeout(() => router.push("/login"), 1500);
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-md border border-green-600/30 bg-green-600/10 px-4 py-3 text-sm text-green-700 dark:text-green-300">
        Password updated. Taking you to the login page…
      </div>
    );
  }

  if (ready === "missing") {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-700 dark:text-amber-300">
          This reset link is invalid or has expired. Please request a new one.
        </p>
        <Link href="/forgot-password" className="underline">
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">New password</span>
        <PasswordInput
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={setPassword}
        />
        <span className="text-xs text-black/50 dark:text-white/50">
          At least 8 characters.
        </span>
      </label>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={status === "saving" || ready !== "ok"}
        className="mt-1 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
      >
        {status === "saving"
          ? "Saving…"
          : ready === "checking"
            ? "Loading…"
            : "Set new password"}
      </button>
    </form>
  );
}
