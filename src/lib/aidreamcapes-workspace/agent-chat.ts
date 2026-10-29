import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { PlatformAiProvider } from "@/lib/types";
import { generatePlatformText, streamPlatformTextProvider } from "@/lib/platform-text-provider";
import { listPlatformAiProvidersRelational } from "@/lib/stores/platform-store";
import { aiProviderStatus } from "@/lib/ai-provider-config";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError } from "./types";
import { listTasks } from "./store";

export const AGENT_CHAT_SITE_ID = AIVIDEOSUGC_SITE_ID;

const MAX_MESSAGE_LENGTH = 8000;
const HISTORY_WINDOW = 20;
const RATE_PER_MINUTE = 10;
const RATE_PER_DAY = 200;
const MAX_CONVERSATIONS = 50;

export type AgentChatMessageView = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type AgentChatConversationView = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type RateBuckets = { minuteCount: number; minuteStart: number; dayCount: number; dayStart: number };
const rateBuckets = new Map<string, RateBuckets>();

function checkRateLimit(customerId: string) {
  const now = Date.now();
  const bucket = rateBuckets.get(customerId) ?? { minuteCount: 0, minuteStart: now, dayCount: 0, dayStart: now };
  if (now - bucket.minuteStart >= 60_000) { bucket.minuteCount = 0; bucket.minuteStart = now; }
  if (now - bucket.dayStart >= 86_400_000) { bucket.dayCount = 0; bucket.dayStart = now; }
  if (bucket.minuteCount >= RATE_PER_MINUTE || bucket.dayCount >= RATE_PER_DAY) {
    throw new WorkspaceError("agent_chat_rate_limited", 429);
  }
  bucket.minuteCount += 1;
  bucket.dayCount += 1;
  rateBuckets.set(customerId, bucket);
}

async function requireTextProvider() {
  const providers = await listPlatformAiProvidersRelational({ providerType: "text" });
  const provider = providers.find((candidate) => aiProviderStatus(candidate).runnable);
  if (!provider) throw new WorkspaceError("agent_chat_provider_unavailable", 503);
  return provider;
}

/** Internal system prompt — server-side configuration, never rendered verbatim in the UI. */
function systemPrompt(context?: { recentTasks?: { title: string; status: string }[] }): string {
  const lines = [
    `You are the AIVIDEOSUGC AI Assistant, the built-in helper of the AIVIDEOSUGC video workspace (aivideosugc.com). Today's date is ${new Date().toLocaleDateString("en-CA", { timeZone: "UTC" })}; rely on it for anything time-related.`,
    "If asked which model powers you or who trained you, never mention other AI companies or model names: you are simply the AIVIDEOSUGC AI Assistant.",
    "You help creators with short-video ideas, scripts, shot planning, product images and marketing copy, and questions about using the AIVIDEOSUGC website and workspace.",
    "Casual small talk and friendly greetings are fine. For substantive help, stay inside the topics above. Do not help with topics that belong to other industries, other platforms' products, or other tools' features. When the user asks for that kind of help, decline once with this wording in the user's language: \"I can help with short-video ideas, scripts, shot planning, product images and marketing copy, and questions about using AIVIDEOSUGC. That topic is outside what I can assist with here.\" Then offer one of the things you can do.",
    "Be concise and practical. Prefer concrete, ready-to-use wording over general advice. Answer in the language the user writes in.",
    "You cannot generate videos or images yourself; when the user wants a finished video, describe the steps in this workspace (Text to Video, AI Video, Library)."
  ];
  if (context?.recentTasks?.length) {
    lines.push(`The user's recent videos in their Library (title — status): ${context.recentTasks.map((task) => `${task.title} — ${task.status}`).join("; ")}. Reference these only if relevant.`);
  }
  return lines.join(" ");
}

async function recentTaskContext(customerId: string) {
  try {
    const tasks = await listTasks(AGENT_CHAT_SITE_ID, customerId);
    return tasks.slice(0, 5).map((task) => ({ title: task.title, status: task.status }));
  } catch { return undefined; }
}

export async function listConversations(customerId: string): Promise<AgentChatConversationView[]> {
  const rows = await prisma.aiChatConversation.findMany({
    where: { siteId: AGENT_CHAT_SITE_ID, customerId },
    orderBy: { updatedAt: "desc" },
    take: MAX_CONVERSATIONS,
    select: { id: true, title: true, createdAt: true, updatedAt: true }
  });
  return rows.map((row) => ({ id: row.id, title: row.title, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }));
}

export async function createConversation(customerId: string, title?: string): Promise<AgentChatConversationView> {
  const row = await prisma.aiChatConversation.create({
    data: { id: `conv_${randomUUID()}`, siteId: AGENT_CHAT_SITE_ID, customerId, title: (title ?? "New conversation").slice(0, 80) }
  });
  return { id: row.id, title: row.title, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

async function requireConversation(customerId: string, conversationId: string) {
  const row = await prisma.aiChatConversation.findFirst({
    where: { id: conversationId, siteId: AGENT_CHAT_SITE_ID, customerId }
  });
  if (!row) throw new WorkspaceError("agent_chat_conversation_not_found", 404);
  return row;
}

export async function getConversationMessages(customerId: string, conversationId: string): Promise<AgentChatMessageView[]> {
  await requireConversation(customerId, conversationId);
  const rows = await prisma.aiChatMessage.findMany({
    where: { conversationId, siteId: AGENT_CHAT_SITE_ID, customerId },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true, createdAt: true }
  });
  return rows.map((row) => ({ id: row.id, role: row.role as "user" | "assistant", content: row.content, createdAt: row.createdAt.toISOString() }));
}

export async function deleteConversation(customerId: string, conversationId: string) {
  await requireConversation(customerId, conversationId);
  await prisma.aiChatMessage.deleteMany({ where: { conversationId, siteId: AGENT_CHAT_SITE_ID, customerId } });
  await prisma.aiChatConversation.deleteMany({ where: { id: conversationId, siteId: AGENT_CHAT_SITE_ID, customerId } });
}

type ChatMessageRow = { role: "system" | "user" | "assistant"; content: string };

async function upstreamMessages(customerId: string, conversationId: string, content: string): Promise<ChatMessageRow[]> {
  const history = await getConversationMessages(customerId, conversationId);
  const context = await recentTaskContext(customerId);
  const window = history.slice(-HISTORY_WINDOW).map((message) => ({ role: message.role, content: message.content }));
  return [{ role: "system", content: systemPrompt(context ? { recentTasks: context } : undefined) }, ...window, { role: "user", content }];
}

async function persistUserMessage(customerId: string, conversationId: string, content: string) {
  await prisma.aiChatMessage.create({
    data: { id: `msg_${randomUUID()}`, conversationId, siteId: AGENT_CHAT_SITE_ID, customerId, role: "user", content }
  });
  await prisma.aiChatConversation.updateMany({
    where: { id: conversationId, siteId: AGENT_CHAT_SITE_ID, customerId },
    data: { updatedAt: new Date() }
  });
}

async function persistAssistantMessage(customerId: string, conversationId: string, content: string, providerId: string | null) {
  await prisma.aiChatMessage.create({
    data: { id: `msg_${randomUUID()}`, conversationId, siteId: AGENT_CHAT_SITE_ID, customerId, role: "assistant", content, providerId }
  });
  await prisma.aiChatConversation.updateMany({
    where: { id: conversationId, siteId: AGENT_CHAT_SITE_ID, customerId },
    data: { updatedAt: new Date() }
  });
}

async function firstConversationTitle(customerId: string, conversationId: string, content: string) {
  const count = await prisma.aiChatMessage.count({ where: { conversationId, siteId: AGENT_CHAT_SITE_ID, customerId } });
  if (count > 0) return;
  await prisma.aiChatConversation.updateMany({
    where: { id: conversationId, siteId: AGENT_CHAT_SITE_ID, customerId },
    data: { title: content.replace(/\s+/g, " ").trim().slice(0, 60) || "New conversation" }
  });
}

/**
 * Streams one assistant reply for the message the user just sent. Persists the
 * user message and the aggregated assistant reply (also on abort/finish).
 * Returns a byte stream of SSE events for the route handler to relay.
 */
export async function sendMessageStream(args: { customerId: string; conversationId: string; content: string; signal: AbortSignal }): Promise<ReadableStream<Uint8Array>> {
  const content = args.content.trim();
  if (!content) throw new WorkspaceError("agent_chat_empty_message", 400);
  if (content.length > MAX_MESSAGE_LENGTH) throw new WorkspaceError("agent_chat_message_too_long", 413);
  await requireConversation(args.customerId, args.conversationId);
  checkRateLimit(args.customerId);
  const useMock = process.env.SMOKE_PROVIDER_MOCK === "1" || process.env.AI_TEXT_PROVIDER_MOCK === "1";
  const provider = useMock
    ? ({ id: "mock-text-provider", label: "Mock text provider" } as unknown as PlatformAiProvider)
    : await requireTextProvider();
  const messages = await upstreamMessages(args.customerId, args.conversationId, content);
  await firstConversationTitle(args.customerId, args.conversationId, content);
  await persistUserMessage(args.customerId, args.conversationId, content);

  const encoder = new TextEncoder();
  let aggregated = "";
  const conversationId = args.conversationId;
  const customerId = args.customerId;
  const upstreamSignal = AbortSignal.any([args.signal, AbortSignal.timeout(120_000)]);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      send({ type: "start" });
      try {
        if (useMock) {
          const mockReply = "This is a mock assistant reply used by automated checks.";
          aggregated += mockReply;
          send({ type: "delta", text: mockReply });
        } else {
          for await (const event of streamPlatformTextProvider({ provider, messages, temperature: 0.7, signal: upstreamSignal })) {
            if (event.type === "delta") {
              aggregated += event.text;
              send({ type: "delta", text: event.text });
            } else {
              send({ type: "done", messageId: null });
            }
          }
        }
        if (!aggregated.trim()) throw new Error("text_provider_empty_response");
      } catch (error) {
        const aborted = (error as Error)?.name === "AbortError";
        if (!aborted && !aggregated.trim()) {
          const code = (error as Error)?.message === "text_provider_empty_response" ? "agent_chat_provider_unavailable" : "agent_chat_provider_failed";
          send({ type: "error", code });
        }
      }
      try {
        if (aggregated.trim()) {
          await persistAssistantMessage(customerId, conversationId, aggregated, provider.id);
          send({ type: "done", saved: true });
        }
      } catch (error) {
        console.error("[agent-chat] persist failed", error);
        send({ type: "error", code: "agent_chat_save_failed" });
      }
      controller.close();
    }
  });
}

/** Non-streaming fallback (used by smoke checks and as a degraded mode). */
export async function sendMessageOnce(args: { customerId: string; conversationId: string; content: string }): Promise<{ content: string; providerLabel: string }> {
  const trimmed = args.content.trim();
  if (!trimmed) throw new WorkspaceError("agent_chat_empty_message", 400);
  if (trimmed.length > MAX_MESSAGE_LENGTH) throw new WorkspaceError("agent_chat_message_too_long", 413);
  await requireConversation(args.customerId, args.conversationId);
  checkRateLimit(args.customerId);
  const messages = await upstreamMessages(args.customerId, args.conversationId, trimmed);
  await firstConversationTitle(args.customerId, args.conversationId, trimmed);
  const result = await generatePlatformText({
    messages,
    temperature: 0.7,
    idempotencyKey: `agent-chat:${args.conversationId}:${Date.now()}`,
    mockText: "This is a mock assistant reply used by automated checks."
  });
  await persistAssistantMessage(args.customerId, args.conversationId, result.text, result.providerId);
  return { content: result.text, providerLabel: result.providerLabel };
}
