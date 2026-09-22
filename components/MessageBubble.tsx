import type { ChatMessage } from "@/lib/types";

export default function MessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-surface-raised border border-border px-4 py-2.5 text-[0.92rem] text-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-1.5 text-[0.68rem] uppercase tracking-[0.12em] text-muted-2">
        Answer
      </div>
      <div className="font-serif text-[1.02rem] leading-[1.7] text-foreground whitespace-pre-wrap">
        {message.content}
        {isStreaming && (
          <span className="animate-caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-accent" />
        )}
      </div>

      {message.citations && message.citations.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {message.citations.map((citation) => (
            <a
              key={citation.paperId}
              href={`https://arxiv.org/abs/${citation.paperId}`}
              target="_blank"
              rel="noopener noreferrer"
              title={citation.snippet}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-[0.72rem] text-muted transition-colors hover:border-accent hover:text-accent"
            >
              <span className="max-w-[220px] truncate">{citation.title}</span>
              <span className="text-muted-2 group-hover:text-accent">
                {citation.year}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
