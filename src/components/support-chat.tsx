import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GREETING = "Hi, I'm TixNaija. Ask me about events, tickets or orders.";
const MAX_MESSAGE_LENGTH = 500;
const SESSION_KEY = "tixnaija-support-session";

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
}

function getSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: GREETING }]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionIdRef = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (!sessionIdRef.current && typeof window !== "undefined") {
    sessionIdRef.current = getSessionId();
  }

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open, needsEmail]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const push = (message: ChatMessage) => setMessages((prev) => [...prev, message]);

  async function ask(message: string, emailOverride?: string) {
    setSending(true);
    setError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("support-bot", {
        body: {
          message,
          sessionId: sessionIdRef.current,
          email: emailOverride || undefined,
        },
      });

      if (invokeError) {
        throw invokeError;
      }

      const payload = data as { reply?: string; needsEmail?: boolean; error?: string } | null;

      if (payload?.needsEmail) {
        setNeedsEmail(true);
        setPendingMessage(message);
      } else {
        setNeedsEmail(false);
        setPendingMessage(null);
      }

      if (payload?.reply) {
        push({ role: "assistant", text: payload.reply });
      } else if (payload?.error) {
        setError(payload.error);
      }
    } catch {
      setError("I couldn't reach support just now. Please try again in a moment.");
    } finally {
      setSending(false);
    }
  }

  function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    push({ role: "user", text });
    void ask(text);
  }

  function handleEmailSubmit() {
    const value = email.trim();
    if (!value || sending) return;

    const original = pendingMessage;
    if (!original) return;
    setEmail("");
    push({ role: "user", text: value });
    setNeedsEmail(false);
    void ask(original, value);
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="TixNaija assistant"
          aria-modal="false"
          className="fixed bottom-24 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl sm:right-6"
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="font-display text-base font-semibold leading-tight tracking-tight text-foreground">
                TixNaija
              </p>
              <p className="text-xs text-muted-foreground">Automated assistant</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex max-h-80 min-h-40 flex-col gap-3 overflow-y-auto px-4 py-4"
            aria-live="polite"
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === "user"
                    ? "max-w-[85%] self-end whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm leading-relaxed text-primary-foreground"
                    : "max-w-[85%] self-start whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-muted px-3 py-2 text-sm leading-relaxed text-foreground"
                }
              >
                {message.text}
              </div>
            ))}

            {sending && (
              <p className="self-start text-xs text-muted-foreground">Checking that for you…</p>
            )}

            {needsEmail && !sending && (
              <div className="self-stretch rounded-xl border border-border bg-background p-3">
                <label
                  htmlFor="support-chat-email"
                  className="mb-2 block text-xs font-medium text-muted-foreground"
                >
                  Email address
                </label>
                <div className="flex gap-2">
                  <Input
                    id="support-chat-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    maxLength={254}
                    onChange={(event) => setEmail(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        handleEmailSubmit();
                      }
                    }}
                    placeholder="you@example.com"
                    className="h-9"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 shrink-0"
                    onClick={handleEmailSubmit}
                    disabled={!email.trim() || sending}
                  >
                    Send
                  </Button>
                </div>
              </div>
            )}

            {error && <p className="self-start text-xs text-destructive">{error}</p>}
          </div>

          <div className="border-t border-border px-3 py-3">
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={draft}
                maxLength={MAX_MESSAGE_LENGTH}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask about an event, ticket or order"
                aria-label="Message the TixNaija assistant"
                className="h-10"
              />
              <Button
                type="button"
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={handleSend}
                disabled={!draft.trim() || sending}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {draft.length > 400 && (
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {draft.length}/{MAX_MESSAGE_LENGTH}
              </p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Close TixNaija assistant" : "Open TixNaija assistant"}
        aria-expanded={open}
        className="fixed bottom-6 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:right-6"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </>
  );
}
