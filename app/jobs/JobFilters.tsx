"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export interface FilterOptions {
  language_pair: string[];
  domain: string[];
  work_type: string[];
}

const LABELS: Record<keyof FilterOptions, string> = {
  language_pair: "Language pair",
  domain: "Domain",
  work_type: "Work type",
};

export function JobFilters({
  options,
  query = "",
}: {
  options: FilterOptions;
  query?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      const qs = params.toString();
      router.push(qs ? `/jobs?${qs}` : "/jobs");
    },
    [router, searchParams]
  );

  const hasFilters = ["language_pair", "domain", "work_type", "q"].some((k) =>
    searchParams.get(k)
  );

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const value = new FormData(e.currentTarget).get("q");
          update("q", typeof value === "string" ? value.trim() : "");
        }}
        className="flex gap-2"
      >
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search title, description, domain…"
          className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
        />
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10">
      {(Object.keys(LABELS) as (keyof FilterOptions)[]).map((key) => (
        <label key={key} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{LABELS[key]}</span>
          <select
            value={searchParams.get(key) ?? ""}
            onChange={(e) => update(key, e.target.value)}
            className="min-w-44 rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20 dark:bg-neutral-900"
          >
            <option value="">All</option>
            {options[key].map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      ))}

      {hasFilters && (
        <button
          type="button"
          onClick={() => router.push("/jobs")}
          className="rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Clear filters
        </button>
      )}
      </div>
    </div>
  );
}
