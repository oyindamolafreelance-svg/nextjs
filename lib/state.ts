import crypto from "node:crypto";

function getSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret) {
    throw new Error("APP_SECRET is not set. Add it to your environment (see .env.example).");
  }
  return secret;
}

/** Signs a small payload so it can be safely round-tripped through an OAuth `state` param. */
export function signState(payload: Record<string, string>): string {
  const base = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", getSecret()).update(base).digest("base64url");
  return `${base}.${sig}`;
}

export function verifyState(state: string): Record<string, string> | null {
  const [base, sig] = state.split(".");
  if (!base || !sig) return null;

  const expected = crypto.createHmac("sha256", getSecret()).update(base).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(base, "base64url").toString());
  } catch {
    return null;
  }
}
