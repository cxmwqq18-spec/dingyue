import crypto from "crypto";

type DesignerPreviewTokenPayload = {
  siteId: string;
  siteSlug: string;
  sessionId: string;
  exp: number;
};

const DESIGNER_PREVIEW_SECRET = process.env.DESIGNER_PREVIEW_SECRET ?? "dev-designer-preview-secret";
const DESIGNER_PREVIEW_TTL_MS = 1000 * 60 * 60 * 4;

function signDesignerPreviewPayload(payload: DesignerPreviewTokenPayload): string {
  return crypto.createHmac("sha256", DESIGNER_PREVIEW_SECRET).update(JSON.stringify(payload)).digest("base64url");
}

function safeCompare(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function createDesignerPreviewToken(input: {
  siteId: string;
  siteSlug: string;
  sessionId: string;
  ttlMs?: number;
}): string {
  const payload: DesignerPreviewTokenPayload = {
    siteId: input.siteId,
    siteSlug: input.siteSlug,
    sessionId: input.sessionId,
    exp: Date.now() + (input.ttlMs ?? DESIGNER_PREVIEW_TTL_MS)
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signDesignerPreviewPayload(payload);
  return `${encodedPayload}.${signature}`;
}

export function verifyDesignerPreviewToken(
  token: string | undefined,
  expected?: { siteId: string; siteSlug: string }
): DesignerPreviewTokenPayload | undefined {
  if (!token) return undefined;
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) return undefined;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as DesignerPreviewTokenPayload;
    if (
      typeof payload.sessionId !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp <= Date.now() ||
      (expected && (payload.siteId !== expected.siteId || payload.siteSlug !== expected.siteSlug))
    ) {
      return undefined;
    }

    const expectedSignature = signDesignerPreviewPayload(payload);
    return safeCompare(signature, expectedSignature) ? payload : undefined;
  } catch {
    return undefined;
  }
}
