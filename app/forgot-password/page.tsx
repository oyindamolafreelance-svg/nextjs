import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Reset your password</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Enter your email and we&apos;ll send you a link to set a new password.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
