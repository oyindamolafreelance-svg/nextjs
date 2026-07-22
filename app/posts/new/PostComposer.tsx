"use client";

import { useState } from "react";
import { createPost } from "@/lib/actions/posts";

type Profile = {
  id: string;
  name: string;
  platform: string;
  niche: string;
};

export function PostComposer({
  profiles,
  defaultProfileId,
}: {
  profiles: Profile[];
  defaultProfileId: string | null;
}) {
  const [profileId, setProfileId] = useState(defaultProfileId ?? profiles[0]?.id ?? "");
  const [caption, setCaption] = useState("");
  const [topic, setTopic] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleGenerate() {
    if (!profileId) return;
    setGenerating(true);
    setNotice(null);
    try {
      const res = await fetch("/api/generate/caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, topic: topic || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to generate caption");
      setCaption(data.caption);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to generate caption");
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setMediaUrl(data.url);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (profiles.length === 0) {
    return (
      <p className="text-sm text-black/60 dark:text-white/60">
        Create a profile first before composing a post.
      </p>
    );
  }

  return (
    <form action={createPost} className="flex max-w-lg flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Profile</span>
        <select
          name="profileId"
          value={profileId}
          onChange={(e) => setProfileId(e.target.value)}
          required
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
        >
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name} ({profile.platform} · {profile.niche})
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Caption</span>
        <textarea
          name="caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          required
          rows={4}
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
        />
        <div className="flex items-center gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Optional topic to guide AI generation"
            className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/20"
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !profileId}
            className="shrink-0 rounded-md border border-black/15 px-3 py-2 text-sm disabled:opacity-50 dark:border-white/20"
          >
            {generating ? "Generating…" : "Generate with AI"}
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Media URL (optional)</span>
        <input
          name="mediaUrl"
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="https://..."
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
        />
      </label>

      <div className="flex items-center gap-2 text-sm">
        <input
          type="file"
          accept="image/*,video/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
          disabled={uploading}
          className="text-sm"
        />
        {uploading && <span className="text-black/50 dark:text-white/50">Uploading…</span>}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Media type</span>
        <select
          name="mediaType"
          defaultValue=""
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
        >
          <option value="">None (text only)</option>
          <option value="IMAGE">Image</option>
          <option value="VIDEO">Video</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Schedule for (optional — leave blank to save as draft)</span>
        <input
          type="datetime-local"
          name="scheduledAt"
          className="rounded-md border border-black/15 bg-transparent px-3 py-2 dark:border-white/20"
        />
      </label>

      {notice && <p className="text-sm text-red-600 dark:text-red-400">{notice}</p>}

      <button
        type="submit"
        className="mt-2 self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black"
      >
        Save post
      </button>
    </form>
  );
}
