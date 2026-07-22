import type { Publisher } from "./types";
import { tiktokPublisher } from "./tiktok";
import { facebookPublisher } from "./facebook";

export * from "./types";

export function getPublisher(platform: "TIKTOK" | "FACEBOOK"): Publisher {
  switch (platform) {
    case "TIKTOK":
      return tiktokPublisher;
    case "FACEBOOK":
      return facebookPublisher;
  }
}
