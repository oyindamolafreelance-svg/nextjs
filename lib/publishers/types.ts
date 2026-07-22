export type MediaType = "IMAGE" | "VIDEO";

export interface PublishInput {
  caption: string;
  mediaUrl: string | null;
  mediaType: MediaType | null;
}

export interface PublishAccount {
  accessToken: string;
  externalAccountId: string | null;
  externalPageId: string | null;
}

export interface PublishResult {
  externalPostId: string;
  /** True if the platform is still processing the upload (e.g. TikTok video review). */
  pending?: boolean;
}

export class PublishError extends Error {
  constructor(
    message: string,
    public readonly platform: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "PublishError";
  }
}

export interface Publisher {
  publish(account: PublishAccount, input: PublishInput): Promise<PublishResult>;
}
