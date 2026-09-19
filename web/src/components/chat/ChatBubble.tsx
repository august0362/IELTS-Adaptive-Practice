"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { ChatWindow } from "./ChatWindow";

/** Floating "Navita" bubble shown on every page except /chat itself (which
 * already shows the full experience — a second floating copy there would
 * just be a confusing duplicate). Reuses ChatWindow's own conversation state
 * (fetched fresh on open), so a message sent here shows up on /chat too. */
export function ChatBubble() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  if (pathname === "/chat") return null;

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-20 right-4 z-50 flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-sm font-semibold text-foreground">Navita</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Đóng Navita"
              className="rounded-full px-2 py-1 text-sm text-foreground/60 hover:bg-border"
            >
              ✕
            </button>
          </div>
          <div className="flex flex-1 overflow-hidden">
            <ChatWindow compact />
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Đóng Navita" : "Mở Navita"}
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        {isOpen ? "✕" : "💬"}
      </button>
    </>
  );
}
