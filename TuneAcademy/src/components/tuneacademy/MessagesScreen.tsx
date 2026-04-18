import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Loader2, MessageSquareText, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import {
  markChatRead,
  sendChatMessage,
  useChatLastMessagePreviews,
  useChatThread,
  useMessagingInvitations,
  useOtherUserProfiles,
  type MessagingConversation,
} from "@/hooks/useMessaging";
import { firestoreLikeToMillis } from "@/lib/firestoreTime";
import { LEARNER_PEER_DM_REEL_ID, otherUserIdFromChatId } from "@/lib/messaging";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/types";

function bubbleTime(m: ChatMessage): string {
  const ms = firestoreLikeToMillis(m.createdAt);
  if (ms == null) return "";
  try {
    return new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function previewSnippet(text: string, max = 72): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export type MessagesScreenProps = {
  /** Opens this chat after navigation (e.g. learner messaged an instructor from their profile). */
  initialChatId?: string;
};

type LearnerConvFilter = "all" | "students" | "instructors";

export function MessagesScreen({ initialChatId }: MessagesScreenProps) {
  const { user, userDoc } = useAuth();
  const uid = user?.uid;
  const myRole = userDoc?.role;

  const {
    conversations,
    loading: loadingInvites,
    error: inviteError,
  } = useMessagingInvitations(uid);

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [learnerFilter, setLearnerFilter] = useState<LearnerConvFilter>("all");

  useEffect(() => {
    if (initialChatId) setSelectedChatId(initialChatId);
  }, [initialChatId]);

  const orphanSynthetic = useMemo((): MessagingConversation | null => {
    if (!selectedChatId || !uid || !myRole) return null;
    if (conversations.some((c) => c.chatId === selectedChatId)) return null;
    const other = otherUserIdFromChatId(selectedChatId, uid);
    if (!other) return null;
    const isLearner = myRole === "learner";
    return {
      chatId: selectedChatId,
      instructorId: isLearner ? other : uid,
      learnerId: isLearner ? uid : other,
      otherUserId: other,
      otherDisplayName: "",
      otherAvatarUrl: "",
      lastInviteActivityMs: 0,
      reelId: "",
    };
  }, [selectedChatId, uid, myRole, conversations]);

  const conversationsAugmented = useMemo(() => {
    if (!orphanSynthetic) return conversations;
    return [...conversations, orphanSynthetic];
  }, [conversations, orphanSynthetic]);

  const chatIds = useMemo(
    () => conversationsAugmented.map((c) => c.chatId),
    [conversationsAugmented],
  );
  const previews = useChatLastMessagePreviews(chatIds);
  const profiles = useOtherUserProfiles(conversationsAugmented, myRole);

  const sortedConversations = useMemo(() => {
    return [...conversationsAugmented].sort((a, b) => {
      const ta = Math.max(previews[a.chatId]?.atMs ?? 0, a.lastInviteActivityMs);
      const tb = Math.max(previews[b.chatId]?.atMs ?? 0, b.lastInviteActivityMs);
      return tb - ta;
    });
  }, [conversationsAugmented, previews]);

  const visibleConversations = useMemo(() => {
    if (myRole !== "learner") return sortedConversations;
    if (learnerFilter === "all") return sortedConversations;
    if (learnerFilter === "students") {
      return sortedConversations.filter((c) => c.reelId === LEARNER_PEER_DM_REEL_ID);
    }
    return sortedConversations.filter((c) => c.reelId !== LEARNER_PEER_DM_REEL_ID);
  }, [sortedConversations, myRole, learnerFilter]);

  const { messages, loading: loadingThread } = useChatThread(selectedChatId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => sortedConversations.find((c) => c.chatId === selectedChatId) ?? null,
    [sortedConversations, selectedChatId],
  );

  useEffect(() => {
    if (!selectedChatId || !uid) return;
    if (conversations.some((c) => c.chatId === selectedChatId)) return;
    if (!otherUserIdFromChatId(selectedChatId, uid)) setSelectedChatId(null);
  }, [selectedChatId, conversations, uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, selectedChatId]);

  const lastMsgId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!selectedChatId || !uid) return;
    void markChatRead(selectedChatId, uid);
  }, [selectedChatId, uid, lastMsgId]);

  useEffect(() => {
    if (inviteError) toast.error(inviteError);
  }, [inviteError]);

  const labelFor = useCallback(
    (c: MessagingConversation) => {
      const p = profiles[c.otherUserId];
      if (p?.fullName) return p.fullName;
      return c.otherDisplayName;
    },
    [profiles],
  );

  const onSend = async () => {
    const text = draft.trim();
    if (!text || !selectedChatId || !uid) return;
    setSending(true);
    try {
      await sendChatMessage(selectedChatId, uid, text);
      setDraft("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send message.");
    } finally {
      setSending(false);
    }
  };

  if (!uid || !myRole) {
    return (
      <p className="mt-10 text-sm text-[#e8f4df]/70">
        Sign in to view messages. If you just created an account, finish onboarding first.
      </p>
    );
  }

  return (
    <div className="mt-8 grid min-h-[min(520px,calc(100vh-12rem))] gap-4 lg:grid-cols-[minmax(0,300px)_1fr]">
      {/* Conversation list */}
      <aside
        className={cn(
          "flex min-h-0 flex-col rounded-lg border border-[#fffdf5]/15 bg-[#fffdf5]/[0.04]",
          selectedChatId ? "hidden lg:flex" : "flex",
        )}
      >
        <div className="border-b border-[#fffdf5]/10 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#e8f4df]/50">
            Conversations
          </p>
        </div>
        {myRole === "learner" ? (
          <div
            className="flex gap-1 border-b border-[#fffdf5]/10 px-2 py-2"
            role="tablist"
            aria-label="Filter conversations"
          >
            {(
              [
                { id: "all" as const, label: "All" },
                { id: "students" as const, label: "Students" },
                { id: "instructors" as const, label: "Instructors" },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={learnerFilter === id}
                onClick={() => setLearnerFilter(id)}
                className={cn(
                  "min-w-0 flex-1 rounded-md px-2 py-2 text-center text-xs font-semibold transition-colors",
                  learnerFilter === id
                    ? "bg-[#2fc5b5]/25 text-[#fffdf5] ring-1 ring-[#2fc5b5]/35"
                    : "text-[#e8f4df]/55 hover:bg-[#fffdf5]/[0.06] hover:text-[#e8f4df]/80",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {loadingInvites ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#e8f4df]/60">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : sortedConversations.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-12 text-center">
              <MessageSquareText
                className="h-10 w-10 text-[#ffd666]/70"
                strokeWidth={1.5}
                aria-hidden
              />
              <p className="mt-4 text-sm font-semibold text-[#fffdf5]">No conversations yet</p>
              <p className="mt-2 text-xs leading-relaxed text-[#e8f4df]/55">
                {myRole === "instructor"
                  ? "When you recruit a learner from MusiReels, your thread appears here for both of you."
                  : "When an instructor reaches out, you message someone from Find instructors, or you message another student from Musireels, the chat appears here."}
              </p>
            </div>
          ) : visibleConversations.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <p className="text-sm font-medium text-[#fffdf5]">No chats in this view</p>
              <p className="mt-2 text-xs leading-relaxed text-[#e8f4df]/55">
                Try another filter, or choose <span className="text-[#e8f4df]/75">All</span> to see every
                thread.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#fffdf5]/8">
              {visibleConversations.map((c) => {
                const prev = previews[c.chatId];
                const snippet = prev?.text ? previewSnippet(prev.text) : "Open to view messages";
                const active = c.chatId === selectedChatId;
                const avatar = profiles[c.otherUserId]?.avatarUrl;
                return (
                  <li key={c.chatId}>
                    <button
                      type="button"
                      onClick={() => setSelectedChatId(c.chatId)}
                      className={cn(
                        "flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-[#fffdf5]/[0.06]",
                        active && "bg-[#2fc5b5]/15",
                      )}
                    >
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-[#fffdf5]/10">
                        {avatar ? (
                          <img src={avatar} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#ffd666]">
                            {(labelFor(c)[0] ?? "?").toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#fffdf5]">
                          {labelFor(c)}
                        </p>
                        <p className="truncate text-xs text-[#e8f4df]/55">{snippet}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      {/* Thread */}
      <section
        className={cn(
          "flex min-h-0 flex-col rounded-lg border border-[#fffdf5]/15 bg-[#fffdf5]/[0.04]",
          !selectedChatId ? "hidden lg:flex" : "flex",
        )}
      >
        {!selectedChatId ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
            <MessageSquareText
              className="h-10 w-10 text-[#a6eee3]/70"
              strokeWidth={1.5}
              aria-hidden
            />
            <p className="mt-4 text-sm text-[#e8f4df]/70">Select a conversation</p>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-2 border-b border-[#fffdf5]/10 px-3 py-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 text-[#fffdf5] hover:bg-[#fffdf5]/10 lg:hidden"
                onClick={() => setSelectedChatId(null)}
                aria-label="Back to conversations"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#fffdf5]/10">
                {selected && profiles[selected.otherUserId]?.avatarUrl ? (
                  <img
                    src={profiles[selected.otherUserId]?.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-sm font-bold text-[#ffd666]">
                    {selected ? (labelFor(selected)[0] ?? "?").toUpperCase() : "?"}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-[#fffdf5]">
                  {selected ? labelFor(selected) : ""}
                </p>
                <p className="text-xs text-[#e8f4df]/50">Direct message</p>
                {myRole === "learner" && selected ? (
                  <p className="text-[10px] font-medium uppercase tracking-wide text-[#e8f4df]/40">
                    {selected.reelId === LEARNER_PEER_DM_REEL_ID ? "Student" : "Instructor"}
                  </p>
                ) : null}
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
              {loadingThread ? (
                <div className="flex justify-center py-10 text-sm text-[#e8f4df]/60">
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-[#e8f4df]/55">
                  No messages in this thread yet.
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === uid;
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
                          mine
                            ? "rounded-br-md bg-[#2fc5b5] text-[#0b1510]"
                            : "rounded-bl-md border border-[#fffdf5]/15 bg-[#0b1510]/80 text-[#fffdf5]",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p
                          className={cn(
                            "mt-1 text-[10px] font-medium opacity-70",
                            mine ? "text-right text-[#0b1510]/80" : "text-[#e8f4df]/60",
                          )}
                        >
                          {bubbleTime(m)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <footer className="border-t border-[#fffdf5]/10 p-3">
              <div className="flex gap-2">
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value.slice(0, 2000))}
                  placeholder="Write a message…"
                  rows={2}
                  className="min-h-[72px] resize-none border-[#fffdf5]/20 bg-[#0b1510]/60 text-[#fffdf5] placeholder:text-[#e8f4df]/40"
                  disabled={sending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void onSend();
                    }
                  }}
                />
                <Button
                  type="button"
                  className="h-auto shrink-0 self-end bg-[#ffd666] text-[#0b1510] hover:bg-[#ffe08a]"
                  onClick={() => void onSend()}
                  disabled={sending || !draft.trim()}
                  aria-label="Send message"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-1 text-right text-[10px] text-[#e8f4df]/45">{draft.length} / 2000</p>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
