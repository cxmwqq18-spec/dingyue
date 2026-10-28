"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, MessageSquare, Plus, Send, Square, Trash2 } from "lucide-react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import styles from "./agent-chat-workbench.module.css";

type ConversationView = { id: string; title: string; createdAt: string; updatedAt: string };
type MessageView = { id: string; role: "user" | "assistant"; content: string; createdAt: string; pending?: boolean };

const SUGGESTIONS = [
  "Help me write a 15-second product video script that ends with a clear call to action.",
  "Give me three shot ideas that show my product's material and build quality.",
  "Turn my product's key features into a short UGC-style voiceover script.",
  "What should I show in the first 3 seconds to stop people from scrolling?"
];

function humanError(code: string): string {
  if (code === "agent_chat_rate_limited") return "You're sending messages too quickly. Please wait a moment and try again.";
  if (code === "agent_chat_provider_unavailable") return "The AI assistant isn't available right now. Please try again later.";
  if (code === "agent_chat_provider_failed") return "The assistant couldn't finish this reply. Please try again.";
  if (code === "agent_chat_save_failed") return "Your message was sent but the reply couldn't be saved. Please try again.";
  if (code === "agent_chat_conversation_not_found") return "This conversation no longer exists.";
  if (code === "agent_chat_message_too_long") return "This message is too long. Please shorten it and try again.";
  if (code === "agent_chat_empty_message") return "Type a message before sending.";
  return "This request couldn't be completed. Please try again.";
}

export function AgentChatWorkbench({ siteId, csrfToken }: { siteId: string; csrfToken?: string }) {
  const requestRoot = `/api/sites/${encodeURIComponent(siteId)}/aivideosugc/chat`;
  const [conversations, setConversations] = useState<ConversationView[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<MessageView[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [streaming, setStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const streamEndRef = useRef<HTMLDivElement | null>(null);

  const headers = useCallback(() => ({ ...customerJsonHeaders(siteId), ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) }), [siteId, csrfToken]);

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch(requestRoot + "/conversations", { credentials: "same-origin", cache: "no-store", headers: headers() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.error || `http_${response.status}`));
      const list = (payload.conversations ?? []) as ConversationView[];
      setConversations(list);
      return list;
    } catch (caught) {
      setError(humanError((caught as Error).message));
      return [] as ConversationView[];
    }
  }, [requestRoot, headers]);

  const openConversation = useCallback(async (conversationId: string) => {
    setActiveId(conversationId);
    setError(""); setMessages([]); setInput("");
    try {
      const response = await fetch(`${requestRoot}/conversations/${encodeURIComponent(conversationId)}`, { credentials: "same-origin", cache: "no-store", headers: headers() });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.error || `http_${response.status}`));
      setMessages((payload.messages ?? []) as MessageView[]);
    } catch (caught) {
      setError(humanError((caught as Error).message));
    }
  }, [requestRoot, headers]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await loadConversations();
      if (!cancelled && list.length) await openConversation(list[0].id);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { streamEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, streaming]);

  async function newConversation() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${requestRoot}/conversations`, { method: "POST", credentials: "same-origin", headers: headers(), body: JSON.stringify({}) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload.error || `http_${response.status}`));
      const conversation = payload.conversation as ConversationView;
      setConversations((current) => [conversation, ...current]);
      setActiveId(conversation.id); setMessages([]); setInput("");
    } catch (caught) { setError(humanError((caught as Error).message)); }
    finally { setBusy(false); }
  }

  async function removeConversation(conversationId: string) {
    if (busy || streaming) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`${requestRoot}/conversations/${encodeURIComponent(conversationId)}`, { method: "DELETE", credentials: "same-origin", headers: headers() });
      if (!response.ok) throw new Error("agent_chat_delete_failed");
      const remaining = conversations.filter((item) => item.id !== conversationId);
      setConversations(remaining);
      if (activeId === conversationId) {
        setActiveId(""); setMessages([]);
        if (remaining.length) await openConversation(remaining[0].id);
      }
    } catch (caught) { setError(humanError((caught as Error).message)); }
    finally { setBusy(false); }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    setError(""); setInput("");
    let conversationId = activeId;
    try {
      if (!conversationId) {
        const response = await fetch(`${requestRoot}/conversations`, { method: "POST", credentials: "same-origin", headers: headers(), body: JSON.stringify({}) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(String(payload.error || `http_${response.status}`));
        const conversation = payload.conversation as ConversationView;
        setConversations((current) => [conversation, ...current]);
        setActiveId(conversation.id);
        conversationId = conversation.id;
      }
      const placeholderId = `pending-${Date.now()}`;
      setMessages((current) => [...current, { id: placeholderId, role: "user", content, createdAt: new Date().toISOString() }, { id: `${placeholderId}-a`, role: "assistant", content: "", createdAt: new Date().toISOString(), pending: true }]);
      setStreaming(true);
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await fetch(`${requestRoot}/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST", credentials: "same-origin", headers: headers(), body: JSON.stringify({ content }), signal: controller.signal
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(String(payload.error || `http_${response.status}`));
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reply = "";
      let failed = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const event = JSON.parse(line.slice(5).trim()) as { type: string; text?: string; code?: string };
            if (event.type === "delta" && event.text) {
              reply += event.text;
              setMessages((current) => current.map((item) => item.id === `${placeholderId}-a` ? { ...item, content: reply, pending: false } : item));
            } else if (event.type === "error" && event.code) {
              failed = event.code;
            }
          } catch { /* Ignore malformed fragments. */ }
        }
      }
      if (failed) throw new Error(failed);
      if (!reply.trim()) throw new Error("agent_chat_provider_failed");
      // Refresh titles after the first exchange renames the conversation.
      void loadConversations();
    } catch (caught) {
      const err = caught as Error;
      if (err.name !== "AbortError") setError(humanError(err.message));
      else setError("");
      setMessages((current) => current.filter((item) => !(item.pending && item.role === "assistant" && !item.content)));
      void loadConversations();
    } finally {
      setStreaming(false);
      abortRef.current = null;
      setMessages((current) => current.map((item) => ({ ...item, pending: false })));
    }
  }

  function stop() { abortRef.current?.abort(); }

  return (
    <div className={styles.root}>
      <aside className={styles.sidebar} aria-label="Conversations">
        <button type="button" className={styles.newButton} onClick={() => void newConversation()} disabled={busy || streaming}><Plus size={15} /><span>New chat</span></button>
        <div className={styles.list}>
          {conversations.map((item) => <div key={item.id} className={`${styles.listItem} ${item.id === activeId ? styles.listItemActive : ""}`}>
            <button type="button" className={styles.listButton} onClick={() => void openConversation(item.id)} title={item.title}><MessageSquare size={14} /><span>{item.title}</span></button>
            <button type="button" className={styles.removeButton} aria-label={`Delete ${item.title}`} onClick={() => void removeConversation(item.id)}><Trash2 size={13} /></button>
          </div>)}
          {!conversations.length && !loading && <p className={styles.empty}>Your conversations will appear here.</p>}
        </div>
      </aside>
      <section className={styles.pane}>
        <div className={styles.stream}>
          {!messages.length && !loading && <div className={styles.welcome}>
            <h2>AI Assistant</h2>
            <p>Ask for video ideas, scripts, shot plans, or product marketing advice.</p>
            <div className={styles.suggestions}>{SUGGESTIONS.map((item) => <button key={item} type="button" className={styles.suggestion} onClick={() => void send(item)}>{item}</button>)}</div>
          </div>}
          {messages.map((message) => <div key={message.id} className={`${styles.row} ${message.role === "user" ? styles.rowUser : ""}`}>
            <div className={`${styles.bubble} ${message.role === "user" ? styles.bubbleUser : styles.bubbleAssistant}`}>
              {message.pending && !message.content ? <Loader2 size={15} className={styles.spin} /> : <span className={styles.text}>{message.content}</span>}
            </div>
          </div>)}
          {streaming && <div className={styles.streamHint}><Loader2 size={13} className={styles.spin} /><span>The assistant is typing…</span></div>}
          <div ref={streamEndRef} />
        </div>
        {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" className={styles.errorClose} onClick={() => setError("")} aria-label="Dismiss message">×</button></div>}
        <div className={styles.composer}>
          <textarea
            className={styles.input} aria-label="Message the AI assistant" rows={2}
            placeholder="Ask for ideas, scripts, or advice…"
            maxLength={8000} value={input} disabled={streaming}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(input); } }}
          />
          {streaming
            ? <button type="button" className={styles.stop} onClick={stop}><Square size={14} /><span>Stop</span></button>
            : <button type="button" className={styles.send} onClick={() => void send(input)} disabled={!input.trim() || busy}><Send size={15} /><span>Send</span></button>}
        </div>
        <p className={styles.help}>Enter to send · Shift+Enter for a new line</p>
      </section>
    </div>
  );
}
