"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registerAction, type AuthFormState } from "@/lib/actions/auth";
import { PasswordInput } from "@/app/_components/PasswordInput";

const initial: AuthFormState = {};

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Full name</span>
        <input
          type="text"
          name="full_name"
          required
          autoComplete="name"
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="input"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Password</span>
        <PasswordInput autoComplete="new-password" minLength={8} />
        <span className="text-xs text-black/50 dark:text-white/50">
          At least 8 characters.
        </span>
      </label>

      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="btn btn-primary mt-1"
      >
        {pending ? "Creating account…" : "Create account"}
      </button>

      <p className="text-sm text-black/60 dark:text-white/60">
        Already have an account?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
