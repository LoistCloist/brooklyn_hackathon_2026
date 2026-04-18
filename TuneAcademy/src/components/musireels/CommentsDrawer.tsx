import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useComments } from "@/hooks/useComments";
import { formatRelativeTime } from "@/lib/formatRelativeTime";
import type { Reel } from "@/types";

type Props = {
  reel: Reel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CommentsDrawer({ reel, open, onOpenChange }: Props) {
  const reelId = reel?.id ?? null;
  const { comments, loading, addComment } = useComments(reelId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) setDraft("");
  }, [open]);

  useEffect(() => {
    if (open && comments.length) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open, comments.length]);

  const send = async () => {
    const t = draft.trim();
    if (!t || !reelId) return;
    setSending(true);
    try {
      await addComment(t);
      setDraft("");
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md border-border bg-background">
        <DrawerHeader>
          <DrawerTitle className="text-left">
            Comments
            <span className="ml-2 text-sm font-normal text-muted-foreground">
              {reel?.commentsCount ?? 0}
            </span>
          </DrawerTitle>
        </DrawerHeader>

        <ScrollArea className="h-[min(50vh,420px)] px-4">
          {loading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No comments yet. Be the first!
            </p>
          ) : (
            <ul className="space-y-4 pb-2">
              {comments.map((c) => (
                <li key={c.id} className="flex gap-3 text-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {(c.authorName.trim()[0] ?? "?").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{c.authorName}</p>
                    <p className="mt-0.5 text-foreground/90">{c.text}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatRelativeTime(c.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div ref={bottomRef} />
        </ScrollArea>

        <DrawerFooter className="border-t border-border pt-2">
          <div className="flex gap-2">
            <Input
              placeholder="Write a comment…"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 500))}
              maxLength={500}
              disabled={sending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button type="button" size="icon" disabled={sending || !draft.trim()} onClick={() => void send()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
