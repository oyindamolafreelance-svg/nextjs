import { login } from "@/lib/actions/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/";
  const hasError = sp.error === "1";

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <form action={login} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <input
          type="password"
          name="password"
          placeholder="Password"
          required
          autoFocus
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
        />
        {hasError && <p className="text-sm text-red-600 dark:text-red-400">Incorrect password.</p>}
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}
