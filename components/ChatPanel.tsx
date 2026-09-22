"use client";

import { useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import type { ChatMessage, Citation } from "@/lib/types";

const EXAMPLE_PROMPTS = [
  "How does the attention mechanism in the Transformer work?",
  "What problem does LoRA solve, and how?",
  "How does RAG differ from just fine-tuning a model on documents?",
  "What is the core idea behind diffusion models?",
];

export default function ChatPanel({
  paperCount,
  onMenuClick,
}: {
  paperCount: number;
  onMenuClick?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const answerRef = useRef("");

  function scrollToBottom() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }

  async function ask(question: string) {
    if (!question.trim() || isStreaming) return;
    setError(null);

    const history = messages;
    const nextMessages: ChatMessage[] = [
      ...history,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ];
    setMessages(nextMessages);
    setInput("");
    setIsStreaming(true);
    scrollToBottom();

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });

      if (!res.ok || !res.body) {
        const data = await res
          .json()
          .catch(() => ({ error: "Something went wrong." }));
        throw new Error(data.error ?? "Something went wrong.");
      }

      const citationsHeader = res.headers.get("X-Citations");
      const citations: Citation[] = citationsHeader
        ? JSON.parse(decodeURIComponent(citationsHeader))
        : [];

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      answerRef.current = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answerRef.current += decoder.decode(value, { stream: true });
        const content = answerRef.current;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content };
          return copy;
        });
        scrollToBottom();
      }

      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: answerRef.current,
          citations,
        };
        return copy;
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
      scrollToBottom();
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-border px-5 py-4 md:px-8">
        <button
          onClick={onMenuClick}
          className="rounded-md border border-border p-1.5 text-muted md:hidden"
          aria-label="Toggle paper list"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M2 4h12M2 8h12M2 12h12"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <div>
          <p className="text-sm font-medium text-foreground">
            Research assistant
          </p>
          <p className="text-xs text-muted-2">
            Answers are grounded in the {paperCount} papers on the left, and
            nothing else.
          </p>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-5 py-6 md:px-8"
      >
        <div className="mx-auto flex max-w-[680px] flex-col gap-7">
          {messages.length === 0 && (
            <div className="animate-fade-up pt-6">
              <h2 className="font-serif text-2xl text-foreground">
                Ask the papers.
              </h2>
              <p className="mt-2 max-w-md text-[0.92rem] leading-relaxed text-muted">
                Questions are answered strictly from the excerpts retrieved out
                of the corpus in the sidebar: a small, working example of
                retrieval-augmented generation.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => ask(prompt)}
                    className="rounded-full border border-border px-3.5 py-1.5 text-left text-[0.78rem] text-muted transition-colors hover:border-accent hover:text-accent"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, i) => (
            <MessageBubble
              key={i}
              message={message}
              isStreaming={isStreaming && i === messages.length - 1}
            />
          ))}

          {error && (
            <div className="rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-[0.85rem] text-foreground">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border px-5 py-4 md:px-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
          className="mx-auto flex max-w-[680px] items-end gap-2 rounded-2xl border border-border-strong bg-surface-raised px-3 py-2 focus-within:border-accent"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder="Ask about attention, diffusion, RAG, fine-tuning…"
            rows={1}
            className="max-h-32 flex-1 resize-none bg-transparent py-1.5 text-[0.92rem] text-foreground placeholder:text-muted-2 focus:outline-none"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            aria-label="Send question"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground transition-opacity disabled:opacity-30"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8h11m0 0L8.5 3.5M13 8l-4.5 4.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
