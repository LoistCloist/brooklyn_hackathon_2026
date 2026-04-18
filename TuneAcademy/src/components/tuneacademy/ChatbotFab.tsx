import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Pill } from "./Pill";

export function ChatbotFab() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: "bot" | "user"; text: string }[]>([
    { role: "bot", text: "Hi! I'm your TuneAcademy assistant. How can I help?" },
  ]);

  function send() {
    if (!input.trim()) return;
    setMessages((m) => [
      ...m,
      { role: "user", text: input.trim() },
      { role: "bot", text: "Thanks — I'm in beta and learning. Try asking about your latest report or finding an instructor." },
    ]);
    setInput("");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI Assistant"
        className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-foreground text-background shadow-elevated transition-transform hover:scale-105 active:scale-95"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              role="dialog"
              className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[70vh] max-w-md flex-col rounded-t-2xl border border-b-0 border-hairline bg-surface shadow-elevated"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 280 }}
            >
              <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">AI Assistant</h3>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Beta</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-5">
                {messages.map((m, i) => (
                  <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={
                        "max-w-[80%] rounded-2xl border px-4 py-2.5 text-sm " +
                        (m.role === "user"
                          ? "bg-foreground text-background border-foreground"
                          : "bg-background border-hairline")
                      }
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 border-t border-hairline p-3">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Ask anything…"
                  className="h-11 flex-1 rounded-full border border-hairline bg-background px-4 text-sm outline-none focus:border-foreground"
                />
                <Pill size="sm" onClick={send} aria-label="Send">
                  <Send className="h-4 w-4" />
                </Pill>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
