"use client";

import { useState } from "react";

// A password field with a show/hide toggle. Client component so it works
// inside both server-rendered and client forms.
export function PasswordInput({
  name = "password",
  autoComplete = "current-password",
  required = true,
  minLength,
  placeholder,
  autoFocus,
  value,
  onChange,
}: {
  name?: string;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  placeholder?: string;
  autoFocus?: boolean;
  value?: string;
  onChange?: (v: string) => void;
}) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        name={name}
        autoComplete={autoComplete}
        required={required}
        minLength={minLength}
        placeholder={placeholder}
        autoFocus={autoFocus}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full rounded-md border border-black/15 bg-transparent px-3 py-2 pr-16 dark:border-white/20"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 px-3 text-xs font-medium text-black/50 hover:text-current dark:text-white/50"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? "Hide" : "Show"}
      </button>
    </div>
  );
}
