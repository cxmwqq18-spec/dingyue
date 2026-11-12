import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { quoteWorkspaceAction } from "./provider";
import { snapshotShot } from "./pipeline";
import { WorkspaceError, type WorkspaceTask } from "./types";

export type PaidAction = "generate_shot" | "compose_shot" | "generate_image";
interface QuotePayload {
  siteId: string; customerId: string; taskId: string; revision: number; action: PaidAction; shotId?: string;
  inputsHash: string; credits: number; providerId?: string; priceBinding?: string;
  /** 首条视频专享价标记：服务端报价时计算（offer 行 + 主打 Wan 通道），随 HMAC 绑定。 */
  trial?: boolean; expiresAt: number;
}
function quoteSecret() {
  const secret = process.env.AIVIDEOSUGC_QUOTE_SECRET || process.env.CSRF_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") throw new WorkspaceError("workspace_quote_secret_required", 503);
  return secret || "local-aivideosugc-quote-secret";
}
function hashInputs(task: WorkspaceTask, shotId?: string) {
  const shot = task.storyboard?.shots.find(s => s.shotId === shotId);
  return createHash("sha256").update(JSON.stringify({ input: task.input, sceneId: task.sceneId, scenePlan: task.storyboard?.scenePlan, shot: shot ? { input: snapshotShot(shot), prompt: shot.prompt } : undefined })).digest("hex");
}
function signature(value: string) { return createHmac("sha256", quoteSecret()).update(`aivideosugc-quote:${value}`).digest("base64url"); }
export async function createQuote(task: WorkspaceTask, action: PaidAction, shotId?: string) {
  const pricing = await quoteWorkspaceAction({ siteId: task.siteId, action, task, shotId });
  if (!pricing.available || !Number.isSafeInteger(pricing.credits) || pricing.credits! < 0) return { available: false, reason: pricing.reason || "workspace_billing_configuration_required" };
  const payload: QuotePayload = { siteId: task.siteId, customerId: task.customerId, taskId: task.taskId, revision: task.revision, action, shotId,
    inputsHash: hashInputs(task, shotId), credits: pricing.credits!, providerId: pricing.providerId, priceBinding: pricing.priceBinding,
    trial: Boolean(pricing.trialOffer), expiresAt: Date.now() + 10 * 60_000 };
  const serialized = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { available: true, quoteToken: `${serialized}.${signature(serialized)}`, credits: payload.credits, currency: "credits", expiresAt: new Date(payload.expiresAt).toISOString(), revision: payload.revision, action, shotId };
}
export async function verifyQuote(task: WorkspaceTask, action: PaidAction, shotId: string | undefined, token: unknown, boundRevision = task.revision): Promise<number> {
  if (typeof token !== "string" || token.length > 6000) throw new WorkspaceError("workspace_quote_required", 428);
  const [serialized, mac, extra] = token.split(".");
  if (!serialized || !mac || extra) throw new WorkspaceError("workspace_quote_invalid", 403);
  const expectedMac = Buffer.from(signature(serialized)); const actualMac = Buffer.from(mac);
  if (expectedMac.length !== actualMac.length || !timingSafeEqual(expectedMac, actualMac)) throw new WorkspaceError("workspace_quote_invalid", 403);
  let payload: QuotePayload;
  try { payload = JSON.parse(Buffer.from(serialized, "base64url").toString()); } catch { throw new WorkspaceError("workspace_quote_invalid", 403); }
  if (payload.siteId !== task.siteId || payload.customerId !== task.customerId || payload.taskId !== task.taskId || payload.revision !== boundRevision || payload.action !== action || payload.shotId !== shotId || payload.inputsHash !== hashInputs(task, shotId)) throw new WorkspaceError("workspace_quote_changed", 409);
  if (!Number.isFinite(payload.expiresAt) || payload.expiresAt < Date.now()) throw new WorkspaceError("workspace_quote_expired", 409);
  const current = await quoteWorkspaceAction({ siteId: task.siteId, action, task, shotId });
  if (!current.available) throw new WorkspaceError(current.reason || "workspace_billing_configuration_required", 422);
  if (current.credits !== payload.credits || current.providerId !== payload.providerId || current.priceBinding !== payload.priceBinding || Boolean(current.trialOffer) !== Boolean(payload.trial)) throw new WorkspaceError("workspace_quote_price_changed", 409);
  return payload.credits;
}
