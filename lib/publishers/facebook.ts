import type { Publisher, PublishAccount, PublishInput, PublishResult } from "./types";
import { PublishError } from "./types";

const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION ?? "v21.0";
const API_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function graphRequest(path: string, params: Record<string, string>) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || json?.error) {
    const message = json?.error?.message ?? `Facebook API request failed (${res.status})`;
    throw new PublishError(message, "FACEBOOK", json);
  }

  return json;
}

export const facebookPublisher: Publisher = {
  async publish(account: PublishAccount, input: PublishInput): Promise<PublishResult> {
    const pageId = account.externalPageId ?? account.externalAccountId;
    if (!pageId) {
      throw new PublishError("Facebook profile is missing a connected Page.", "FACEBOOK");
    }

    if (!input.mediaUrl) {
      const result = await graphRequest(`/${pageId}/feed`, {
        message: input.caption,
        access_token: account.accessToken,
      });
      return { externalPostId: result.id };
    }

    if (input.mediaType === "VIDEO") {
      const result = await graphRequest(`/${pageId}/videos`, {
        file_url: input.mediaUrl,
        description: input.caption,
        access_token: account.accessToken,
      });
      return { externalPostId: result.id, pending: true };
    }

    const result = await graphRequest(`/${pageId}/photos`, {
      url: input.mediaUrl,
      caption: input.caption,
      access_token: account.accessToken,
    });
    return { externalPostId: result.post_id ?? result.id };
  },
};
