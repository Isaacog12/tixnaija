import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserName(session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || null);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUserName(session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || null);
      } else {
        setUserName(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("chat-support", {
        body: { history: messages, message: userMessage }
      });

      if (error) {
        console.error("Function error:", error);
        setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error connecting to the server. Please try again." }]);
      } else if (data?.text) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.text }]);
      } else if (data?.error) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error }]);
      } else {
         setMessages((prev) => [...prev, { role: "assistant", content: "I'm sorry, something went wrong." }]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error. Please try again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105 active:scale-95"
        aria-label="Open support chat"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    );
  }

  const greeting = userName 
    ? `Hi, I'm TixNaija's assistant — how can I help you today, ${userName}?`
    : "Hi, I'm TixNaija's assistant — how can I help you today?";

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[500px] max-h-[80vh] w-[350px] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3">
        <div>
          <h3 className="font-semibold text-foreground">Support</h3>
          <p className="text-xs text-muted-foreground">Typically replies instantly</p>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Close chat"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Message Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Initial Greeting */}
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-accent px-4 py-2.5 text-sm text-accent-foreground">
            {greeting}
          </div>
        </div>

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div 
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === "user" 
                  ? "bg-primary text-primary-foreground rounded-tr-sm" 
                  : "bg-accent text-accent-foreground rounded-tl-sm whitespace-pre-wrap"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-accent px-4 py-3 text-accent-foreground flex items-center space-x-2">
               <span className="flex space-x-1">
                 <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: "0ms" }}></span>
                 <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: "150ms" }}></span>
                 <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-foreground/40" style={{ animationDelay: "300ms" }}></span>
               </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-card p-3">
        <div className="flex items-center gap-2 rounded-full border border-input bg-background pr-1 pl-4 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -ml-0.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
