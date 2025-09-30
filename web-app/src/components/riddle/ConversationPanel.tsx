"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Send, Sparkles } from "lucide-react";

export type ChatMessage = {
  id: string;
  text: string;
  createdAt: number;
  author: "user" | "master";
};

interface ConversationPanelProps {
  messages: ChatMessage[];
  isMasterTyping: boolean;
  isSending: boolean;
  onSend: (text: string) => Promise<void>;
  onRequestHint?: () => void;
  hasMoreHints?: boolean;
  disableInput?: boolean;
}

export const ConversationPanel = ({
  messages,
  isMasterTyping,
  isSending,
  onSend,
  onRequestHint,
  hasMoreHints = false,
  disableInput = false,
}: ConversationPanelProps) => {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isMasterTyping]);

  const headerInfo = useMemo(() => {
    if (messages.length === 0) {
      return { exchanges: 0, elapsedMinutes: 0 };
    }
    const exchanges = messages.length;
    const start = new Date(messages[0].createdAt);
    const elapsedMinutes = Math.max(Math.round((Date.now() - start.getTime()) / 60000), 0);
    return { exchanges, elapsedMinutes };
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending || disableInput) return;
    setInput("");
    await onSend(trimmed);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await handleSend();
  };

  const disabled = disableInput || isSending;

  return (
    <section className="flex h-full flex-col rounded-3xl border border-border bg-white shadow-xl">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Conversation
          </p>
          <h2 className="text-xl font-semibold text-foreground">Avec le Maître</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1">
            <Sparkles className="h-3 w-3 text-primary" /> {headerInfo.exchanges} échanges
          </span>
          <span>{headerInfo.elapsedMinutes} min de réflexion</span>
        </div>
      </header>

      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn("flex w-full", message.author === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[75%] rounded-3xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                message.author === "user"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted text-foreground",
              )}
            >
              {message.text}
            </div>
          </div>
        ))}

        {isMasterTyping && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden />
            Le Maître réfléchit…
          </div>
        )}
      </div>

      <footer className="border-t border-border px-6 py-4">
        <form className="flex items-end gap-3" onSubmit={handleSubmit}>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:bg-muted disabled:opacity-50"
            onClick={onRequestHint}
            disabled={!onRequestHint || !hasMoreHints}
            title="Demander un indice"
          >
            <Plus className="h-5 w-5" />
          </button>
          <div className="flex flex-1 items-center rounded-2xl border border-border bg-white px-4 shadow-sm focus-within:border-primary">
            <textarea
              rows={1}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Partage ton intuition…"
              className="flex-1 resize-none bg-transparent py-3 text-sm text-foreground outline-none"
              disabled={disabled}
            />
            <button
              type="submit"
              className="rounded-full bg-primary p-2 text-primary-foreground transition hover:bg-primary/90 disabled:bg-muted"
              disabled={disabled || input.trim().length === 0}
              title="Envoyer"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </form>
      </footer>
    </section>
  );
};
