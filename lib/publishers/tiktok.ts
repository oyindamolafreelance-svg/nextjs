import type { Publisher, PublishAccount, PublishInput, PublishResult } from "./types";
import { PublishError } from "./types";

const API_BASE = "https://open.tiktokapis.com/v2";

// Unaudited apps can only post to SELF_ONLY (private/draft) visibility.
// Once TikTok approves the app for the `video.publish` scope with public
// posting, switch this to "PUBLIC_TO_EVERYONE".
const PRIVACY_LEVEL = process.env.TIKTOK_PRIVACY_LEVEL ?? "SELF_ONLY";

async function tiktokRequest(path: string, accessToken: string, body: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || json?.error?.code !== "ok") {
    const message = json?.error?.message ?? `TikTok API request failed (${res.status})`;
    throw new PublishError(message, "TIKTOK", json);
  }

  return json;
}

async function pollStatus(accessToken: string, publishId: string) {
  // A handful of quick polls; TikTok can take longer for video review, in
  // which case the post is left as "pending" for the caller to reconcile.
  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const status = await tiktokRequest("/post/publish/status/fetch/", accessToken, {
      publish_id: publishId,
    });
    const state = status?.data?.status;
    if (state === "PUBLISH_COMPLETE") {
      return { pending: false };
    }
    if (state === "FAILED") {
      throw new PublishError(
        status?.data?.fail_reason ?? "TikTok publish failed",
        "TIKTOK",
        status
      );
    }
  }
  return { pending: true };
}

export const tiktokPublisher: Publisher = {
  async publish(account: PublishAccount, input: PublishInput): Promise<PublishResult> {
    if (!input.mediaUrl || !input.mediaType) {
      throw new PublishError("TikTok posts require a video or photo.", "TIKTOK");
    }

    const postInfo = {
      title: input.caption,
      privacy_level: PRIVACY_LEVEL,
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
    };

    if (input.mediaType === "VIDEO") {
      const init = await tiktokRequest("/post/publish/video/init/", account.accessToken, {
        post_info: { ...postInfo, video_cover_timestamp_ms: 1000 },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: input.mediaUrl,
        },
      });

      const publishId = init?.data?.publish_id as string | undefined;
      if (!publishId) {
        throw new PublishError("TikTok did not return a publish_id.", "TIKTOK", init);
      }

      const { pending } = await pollStatus(account.accessToken, publishId);
      return { externalPostId: publishId, pending };
    }

    // PHOTO
    const init = await tiktokRequest("/post/publish/content/init/", account.accessToken, {
      post_mode: "DIRECT_POST",
      media_type: "PHOTO",
      post_info: postInfo,
      source_info: {
        source: "PULL_FROM_URL",
        photo_images: [input.mediaUrl],
        photo_cover_index: 0,
      },
    });

    const publishId = init?.data?.publish_id as string | undefined;
    if (!publishId) {
      throw new PublishError("TikTok did not return a publish_id.", "TIKTOK", init);
    }

    const { pending } = await pollStatus(account.accessToken, publishId);
    return { externalPostId: publishId, pending };
  },
};
