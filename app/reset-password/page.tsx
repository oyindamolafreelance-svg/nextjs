import { ResetPasswordForm } from "./ResetPasswordForm";

export default function ResetPasswordPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-5">
      <h1 className="text-xl font-semibold">Set a new password</h1>
      <ResetPasswordForm />
    </div>
  );
}
