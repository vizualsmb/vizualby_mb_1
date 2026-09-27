"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

const WIDGET_ENDPOINT = "https://keen-smart-assist-flow.base44.app/api/apps/6ab84f46ebe2035c90fd627d/functions/widgetApi";
const CLIENT_ID = "MB001";

type WidgetConfig = {
  assistant_name?: string;
  welcome_message?: string;
  suggested_questions?: string[];
  colors?: { primary?: string; secondary?: string };
};

type Message = { role: "assistant" | "user"; text: string };

function quickRepliesFor(text: string) {
  if (!text.includes("?")) return [];
  if (/name|email|phone|contact|details/i.test(text)) return ["Yes, let's continue", "Not yet"];
  return ["Yes", "Not yet", "Tell me more"];
}

async function callWidget(body: Record<string, unknown>) {
  const response = await fetch(WIDGET_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Assistant unavailable");
  return response.json() as Promise<Record<string, unknown>>;
}

function visitorId() {
  const key = "vizuals-assistant-visitor";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  window.localStorage.setItem(key, value);
  return value;
}

export function PublicAssistant() {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<WidgetConfig>({});
  const [conversation, setConversation] = useState<{ id: string; token: string; session: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    callWidget({ action: "config", client_id: CLIENT_ID })
      .then((data) => {
        const next = data as WidgetConfig;
        setConfig(next);
        if (next.welcome_message) setMessages([{ role: "assistant", text: next.welcome_message }]);
      })
      .catch(() => setError("Assistant temporarily unavailable."));
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function ensureConversation() {
    if (conversation) return conversation;
    const session = visitorId();
    const started = await callWidget({ action: "start", client_id: CLIENT_ID, session_id: session, page_url: window.location.href });
    const next = { id: String(started.conversation_id), token: String(started.session_token), session };
    setConversation(next);
    return next;
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setDraft("");
    setError("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    setBusy(true);
    try {
      const active = await ensureConversation();
      const reply = await callWidget({ action: "message", client_id: CLIENT_ID, conversation_id: active.id, session_token: active.token, message });
      setMessages((current) => [...current, { role: "assistant", text: String(reply.reply || "I can help with that. What would you like to make?") }]);
    } catch {
      setError("I couldn't reach the assistant. Please try again or email hello@vizualbymb.com.");
    } finally { setBusy(false); }
  }

  function submit(event: FormEvent) { event.preventDefault(); void send(draft); }

  const latest = messages.at(-1);
  const quickReplies = latest?.role === "assistant" && messages.length > 1 ? quickRepliesFor(latest.text) : [];

  return (
    <aside className={`public-assistant ${open ? "public-assistant-open" : ""}`} aria-label="Yuma booking assistant">
      {open && (
        <section className="public-assistant-panel" role="dialog" aria-label={`${config.assistant_name || "Yuma"} assistant`}>
          <header className="public-assistant-head">
            <div><span className="public-assistant-eyebrow">VIZUAL BY MB</span><strong>{config.assistant_name || "Yuma"}</strong></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close assistant">×</button>
          </header>
          <div className="public-assistant-messages" aria-live="polite">
            {messages.map((item, index) => <p key={`${item.role}-${index}`} className={`public-assistant-message ${item.role}`}>{item.text}</p>)}
            {busy && <p className="public-assistant-message assistant">Thinking…</p>}
            {error && <p className="public-assistant-error">{error}</p>}
            <div ref={endRef} />
          </div>
          {quickReplies.length > 0 && !busy && (
            <div className="public-assistant-quick-replies" aria-label="Quick replies">
              {quickReplies.map((reply) => <button type="button" key={reply} onClick={() => void send(reply)}>{reply}</button>)}
            </div>
          )}
          {(config.suggested_questions || []).length > 0 && messages.length < 2 && (
            <div className="public-assistant-suggestions">{config.suggested_questions?.slice(0, 3).map((question) => <button type="button" key={question} onClick={() => void send(question)}>{question}</button>)}</div>
          )}
          <form className="public-assistant-form" onSubmit={submit}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about a project…" aria-label="Message Yuma" />
            <button type="submit" disabled={busy || !draft.trim()} aria-label="Send message">↗</button>
          </form>
        </section>
      )}
      <button type="button" className="public-assistant-launcher" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span className="public-assistant-dot" /> {open ? "Close" : `Ask ${config.assistant_name || "Yuma"}`}
      </button>
    </aside>
  );
}
