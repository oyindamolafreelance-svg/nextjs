"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type AuthFormState } from "@/lib/actions/auth";
import { PasswordInput } from "@/app/_components/PasswordInput";

const initial: AuthFormState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoFocus
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Password</span>
        <PasswordInput autoComplete="current-password" />
      </label>

      <div className="text-right">
        <Link
          href="/forgot-password"
          className="text-sm text-black/60 underline hover:text-current dark:text-white/60"
        >
          Forgot password?
        </Link>
      </div>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-1"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>

      <p className="text-sm text-black/60 dark:text-white/60">
        Need an account?{" "}
        <Link href="/register" className="underline">
          Register
        </Link>
      </p>
    </form>
  );
}
