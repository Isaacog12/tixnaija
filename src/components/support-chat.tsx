import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GREETING = "Hi, I'm TixNaija. Ask me about events, tickets or orders.";
const MAX_MESSAGE_LENGTH = 500;
const SESSION_KEY = "tixnaija-support-session";
const TRANSCRIPT_KEY = "tixnaija-support-transcript";
const CASE_KEY = "tixnaija-support-case";
const CONTEXT_KEY = "tixnaija-support-context";
const INTENT_KEY = "tixnaija-support-intent";

/**
 * Shown until the conversation has a subject. Most first messages are one of
 * these, and typing "talk to a person" exactly is the difference between a
 * case and a guess.
 */
const QUICK_REPLIES = [
  "What's on this weekend?",
  "My ticket hasn't arrived",
  "What is your refund policy?",
  "Talk to a person",
];

/** Long enough to be useful after a refresh, short enough to stay out of the way. */
const MAX_TRANSCRIPT_MESSAGES = 40;

const UNREACHABLE = "I couldn't reach support just now. Please try again in a moment.";

interface EventCard {
  title: string;
  slug: string;
  when: string;
  place: string | null;
  url: string;
}

interface ActionLink {
  label: string;
  href: string;
}

interface ChatMessage {
  role: "assistant" | "user";
  text: string;
  cards?: EventCard[];
  links?: ActionLink[];
  /** Kept out of storage. Used for the address a guest types to escalate. */
  ephemeral?: boolean;
}

interface BotReply {
  reply?: string;
  needsEmail?: boolean;
  error?: string;
  context?: string;
  intent?: string;
  cards?: EventCard[];
  links?: ActionLink[];
  caseNumber?: string;
}

function isSafeInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//") && !href.includes("\\");
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

/**
 * Reads the server's own message off a failed invocation.
 *
 * `functions.invoke()` resolves with `{ data: null, error }` on a non-2xx
 * response rather than rejecting, so the wording the Edge Function chose —
 * "Too many messages. Please wait a few minutes" on 429, "Please keep your
 * message under 500 characters" on 400 — never reached the screen. Everything
 * collapsed into one generic line telling a rate-limited user to retry at once,
 * which extended the rate limit.
 */
async function readServerMessage(context: unknown): Promise<string | null> {
  const response = context as { json?: () => Promise<unknown> } | null | undefined;
  if (!response || typeof response.json !== "function") return null;
  try {
    const body = (await response.json()) as { error?: unknown } | null;
    return typeof body?.error === "string" && body.error.trim().length > 0 ? body.error : null;
  } catch {
    return null;
  }
}

function readStoredMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(TRANSCRIPT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(-MAX_TRANSCRIPT_MESSAGES) as ChatMessage[];
  } catch {
    return [];
  }
}

function readStoredText(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function storeText(key: string, value: string): void {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // Conversation memory is helpful, but never worth breaking chat over.
  }
}

function readStoredCase(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(CASE_KEY);
  } catch {
    return null;
  }
}

function readStoredIntent(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(INTENT_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeCase(caseNumber: string): void {
  try {
    sessionStorage.setItem(CASE_KEY, caseNumber);
  } catch {
    // A missing reference number is an inconvenience, not a failure worth
    // interrupting the conversation for.
  }
}

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // The transcript lived only in React state, so a refresh mid-conversation
    // lost everything — including the case number the customer had just been
    // told to keep. Restored from sessionStorage instead.
    const stored = readStoredMessages();
    return stored.length > 0 ? stored : [{ role: "assistant", text: GREETING }];
  });
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [needsEmail, setNeedsEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<string>(() => readStoredText(CONTEXT_KEY));
  const [caseNumber, setCaseNumber] = useState<string | null>(() => readStoredCase());
  const [lastIntent, setLastIntent] = useState<string>(() => readStoredIntent());
  const [copied, setCopied] = useState(false);

  const sessionIdRef = useRef<string>("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);

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
      if (event.key !== "Escape") return;
      setOpen(false);
      // Return focus to the launcher instead of stranding keyboard users at
      // the top of the document.
      launcherRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Tapping or clicking anywhere outside the panel closes it. Pointerdown
  // rather than click so a mouse, a finger and a pen all behave the same, and
  // the launcher is excluded because its own handler toggles the panel.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (launcherRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  const push = (message: ChatMessage) => setMessages((prev) => [...prev, message]);

  useEffect(() => {
    storeText(CONTEXT_KEY, context);
  }, [context]);

  useEffect(() => {
    try {
      const storable = messages
        .filter((message) => !message.ephemeral)
        .slice(-MAX_TRANSCRIPT_MESSAGES);
      sessionStorage.setItem(TRANSCRIPT_KEY, JSON.stringify(storable));
    } catch {
      // Storage may be blocked or full. Losing history silently is acceptable;
      // interrupting a working conversation over it is not.
    }
  }, [messages]);

  async function ask(message: string, emailOverride?: string) {
    setSending(true);
    setError(null);
    try {
      const result = await supabase.functions.invoke("support-bot", {
        body: {
          message,
          sessionId: sessionIdRef.current,
          email: emailOverride || undefined,
          context: context || undefined,
          // Lets "and the venue?" keep its subject; the server validates it.
          previousIntent: lastIntent || undefined,
        },
      });

      // invoke() resolves rather than rejects on a non-2xx, so this branch — not
      // the catch below — is where a 429 or 400 lands. The server's own wording
      // is on the response body and is the one worth showing.
      if (result.error) {
        const serverMessage = await readServerMessage(result.error.context);
        setError(serverMessage ?? UNREACHABLE);
        return;
      }

      const payload = result.data as BotReply | null;

      if (payload?.context) {
        setContext(payload.context);
      }

      if (payload?.intent) {
        setLastIntent(payload.intent);
        try {
          sessionStorage.setItem(INTENT_KEY, payload.intent);
        } catch {
          // Losing the follow-up subject is not worth breaking a reply over.
        }
      }

      if (payload?.caseNumber) {
        setCaseNumber(payload.caseNumber);
        storeCase(payload.caseNumber);
      }

      if (payload?.needsEmail) {
        setNeedsEmail(true);
        setPendingMessage(message);
      } else {
        setNeedsEmail(false);
        setPendingMessage(null);
      }

      if (payload?.reply) {
        push({ role: "assistant", text: payload.reply, cards: payload.cards, links: payload.links });
      } else if (payload?.error) {
        setError(payload.error);
      } else {
        // A 200 carrying neither a reply nor an error breaks the contract.
        // Saying so beats the previous behaviour of ending the turn in silence.
        setError(UNREACHABLE);
      }
    } catch {
      setError(UNREACHABLE);
    } finally {
      setSending(false);
    }
  }

  function send(text: string) {
    const value = text.trim();
    if (!value || sending) return;
    push({ role: "user", text: value });
    void ask(value);
  }

  function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    send(text);
  }

  async function copyCaseNumber() {
    if (!caseNumber) return;
    try {
      await navigator.clipboard.writeText(caseNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be blocked; the number stays readable either way.
    }
  }

  function handleEmailSubmit() {
    const value = email.trim();
    if (!value || sending) return;

    const original = pendingMessage;
    if (!original) return;
    setEmail("");
    // Marked ephemeral so the address a guest typed is never written to storage.
    push({ role: "user", text: value, ephemeral: true });
    setNeedsEmail(false);
    void ask(original, value);
  }

  return (
    <>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="TixNaija assistant"
          aria-modal="false"
          // Edge-to-edge on a phone, capped to the visible viewport so the input
          // row can never be pushed off-screen by a long conversation.
          className="fixed bottom-24 left-3 right-3 z-50 flex max-h-[calc(100dvh-7.5rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl sm:left-auto sm:right-6 sm:w-[24rem]"
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <p className="font-display text-base font-semibold leading-tight tracking-tight text-foreground">
                TixNaija
              </p>
              <p className="text-xs text-muted-foreground">
                {caseNumber ? (
                  <span className="inline-flex items-center gap-1.5">
                    {`Automated assistant · ${caseNumber}`}
                    <button
                      type="button"
                      onClick={() => void copyCaseNumber()}
                      className="underline underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label="Copy case number"
                    >
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </span>
                ) : (
                  "Automated assistant"
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                launcherRef.current?.focus();
              }}
              aria-label="Close assistant"
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex min-h-40 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4"
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
                {/*
                  Replies used to carry paths as literal text — "/e/lagos-fest"
                  rendered as inert characters inside a plain div, so the customer
                  had to retype them into the address bar on a phone. Cards are
                  the structured form the Edge Function now sends alongside.
                */}
                {message.links && message.links.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.links.filter((link) => isSafeInternalHref(link.href)).map((link, linkIndex) => (
                      <a
                        key={`${link.href}-${linkIndex}`}
                        href={link.href}
                        download={link.href === "/Tixnaija.apk" ? "Tixnaija.apk" : undefined}
                        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                )}

                {message.cards && message.cards.length > 0 && (
                  <div className="mt-2 flex flex-col gap-1.5">
                    {message.cards.map((card, cardIndex) => (
                      <Link
                        key={`${card.slug}-${cardIndex}`}
                        to="/e/$slug"
                        params={{ slug: card.slug }}
                        className="block rounded-xl border border-border bg-background px-3 py-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="block text-xs font-semibold leading-tight text-foreground">
                          {card.title}
                        </span>
                        <span className="block text-[11px] leading-tight text-muted-foreground">
                          {card.when}
                        </span>
                        {card.place && (
                          <span className="block text-[11px] leading-tight text-muted-foreground">
                            {card.place}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}
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

          <div className="shrink-0 border-t border-border px-3 py-3">
            {messages.length <= 2 && !sending && (
              <div className="flex flex-wrap gap-1.5 pb-2">
                {QUICK_REPLIES.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => send(suggestion)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
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
        ref={launcherRef}
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
