import { createProfile } from "@/lib/actions/profiles";

export default function NewProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">New profile</h1>
      <p className="text-sm text-black/60 dark:text-white/60">
        One profile = one platform account. Give it a niche and brand kit so generated captions
        stay on-brand and consistent.
      </p>

      <form action={createProfile} className="flex max-w-lg flex-col gap-4">
        <Field label="Name" name="name" placeholder="e.g. Glowup Skincare — TikTok" required />

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Platform</span>
          <select
            name="platform"
            required
            className="rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
          >
            <option value="TIKTOK">TikTok</option>
            <option value="FACEBOOK">Facebook</option>
          </select>
        </label>

        <Field
          label="Niche"
          name="niche"
          placeholder="e.g. affordable skincare for oily skin"
          required
        />

        <Field
          label="Brand tone (optional)"
          name="brandTone"
          placeholder="e.g. playful, Gen-Z, no corporate jargon"
        />

        <Field
          label="Brand hashtags (optional, space-separated)"
          name="brandHashtags"
          placeholder="#glowup #skincaretips"
        />

        <Field
          label="Brand colors (optional, comma-separated hex codes)"
          name="brandColors"
          placeholder="#FF6B6B, #1A1A2E"
        />

        <Field label="Logo URL (optional)" name="logoUrl" placeholder="https://..." />

        <button
          type="submit"
          className="mt-2 self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
        >
          Create profile
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        className="rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
      />
    </label>
  );
}
