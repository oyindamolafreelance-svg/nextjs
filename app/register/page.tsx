import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect(user.profile.is_approved ? "/jobs" : "/pending");

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          New accounts are reviewed by the site owner before they can browse the
          board.
        </p>
      </div>
      <RegisterForm />
    </div>
  );
}
