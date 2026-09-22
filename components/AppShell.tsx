"use client";

import { useState } from "react";
import PaperSidebar from "./PaperSidebar";
import ChatPanel from "./ChatPanel";
import type { Paper } from "@/lib/types";

export default function AppShell({ papers }: { papers: Paper[] }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-dvh w-full bg-background text-foreground">
      <div className="mx-auto flex h-full max-w-[1180px] md:border-x md:border-border">
        <aside className="hidden w-[280px] shrink-0 border-r border-border bg-surface md:block">
          <PaperSidebar papers={papers} />
        </aside>

        {sidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="absolute left-0 top-0 h-full w-[280px] bg-surface shadow-xl">
              <PaperSidebar
                papers={papers}
                onLinkClick={() => setSidebarOpen(false)}
              />
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <ChatPanel
            paperCount={papers.length}
            onMenuClick={() => setSidebarOpen(true)}
          />
        </main>
      </div>
    </div>
  );
}
