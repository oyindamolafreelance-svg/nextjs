import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getSessionUser();
  if (user) redirect(user.profile.is_approved ? "/jobs" : "/pending");

  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : "/jobs";
  const justRegistered = sp.registered === "1";

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5">
      <h1 className="text-xl font-semibold">Sign in</h1>
      {justRegistered && (
        <p className="rounded-md border border-green-600/30 bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-300">
          Account created. Please confirm your email if prompted, then sign in.
        </p>
      )}
      <LoginForm next={next} />
    </div>
  );
}
