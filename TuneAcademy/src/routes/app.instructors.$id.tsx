import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Card } from "@/components/tuneacademy/Card";
import { Avatar } from "@/components/tuneacademy/Avatar";
import { Pill } from "@/components/tuneacademy/Pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { formatSpecialtyLabel } from "@/hooks/useInstructorsDirectory";
import { ensureLearnerInstructorThread } from "@/hooks/useMessaging";
import { getInstructorDoc } from "@/lib/tuneacademyFirestore";
import type { InstructorFirestoreDoc } from "@/lib/tuneacademyFirestore";
import { ArrowLeft, Star, MessageSquare, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/app/instructors/$id")({
  head: () => ({ meta: [{ title: "Instructor — TuneAcademy" }] }),
  component: InstructorProfile,
});

const SLOTS = ["9:00 AM", "11:00 AM", "2:00 PM", "5:00 PM"];

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function InstructorProfile() {
  const { id } = Route.useParams();
  const nav = useNavigate();
  const { user, userDoc } = useAuth();
  const [i, setI] = useState<InstructorFirestoreDoc | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void getInstructorDoc(id).then((doc) => {
      setI(doc && doc.bio?.trim() ? doc : null);
      setLoading(false);
    });
  }, [id]);

  const [open, setOpen] = useState<"request" | "chat" | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [dmText, setDmText] = useState("");
  const [dmSending, setDmSending] = useState(false);

  const canDm =
    Boolean(user?.uid) && userDoc?.role === "learner" && user?.uid !== id && Boolean(i?.fullName);

  const sendDm = async () => {
    if (!user?.uid || !i) return;
    const text = dmText.trim();
    if (!text) {
      toast.error("Write a message first.");
      return;
    }
    setDmSending(true);
    try {
      const chatId = await ensureLearnerInstructorThread({
        learnerId: user.uid,
        learnerName: userDoc?.fullName?.trim() || user.displayName || "Learner",
        instructorId: id,
        instructorName: i.fullName.trim(),
        message: text,
      });
      toast.success("Message sent");
      setOpen(null);
      setDmText("");
      void nav({ to: "/app/messages", search: { chat: chatId } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send message.");
    } finally {
      setDmSending(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <header className="flex items-center justify-between px-5 pt-6">
          <button
            type="button"
            onClick={() => nav({ to: "/app/instructors" })}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        </header>
        <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
      </AppShell>
    );
  }

  if (!i) {
    return (
      <AppShell>
        <div className="p-8 text-center text-sm text-muted-foreground">
          Instructor not found.{" "}
          <Link to="/app/instructors" className="underline">
            Back
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="flex items-center justify-between px-5 pt-6">
        <button
          type="button"
          onClick={() => nav({ to: "/app/instructors" })}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </header>

      <div className="flex flex-col items-center px-5 pt-6 text-center">
        <Avatar
          initials={initialsFromName(i.fullName)}
          src={i.avatarUrl}
          size={88}
          className="text-2xl"
        />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{i.fullName}</h1>
        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-foreground text-foreground" />
          <span className="tabular-nums text-foreground">{i.rating.toFixed(1)}</span>
          <span>
            · {i.reviewCount} reviews · {i.experienceYears} yrs
          </span>
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {i.specialties.map((s: string) => (
            <span
              key={s}
              className="rounded-full border border-hairline px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              {formatSpecialtyLabel(s)}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs font-medium">
          {i.hourlyRate === 0 ? "Free first lesson" : `$${i.hourlyRate}/hr`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 pt-6">
        <Pill onClick={() => setOpen("request")}>
          <Calendar className="h-4 w-4" /> Request session
        </Pill>
        <Pill
          variant="secondary"
          disabled={!canDm}
          onClick={() => {
            if (!canDm) {
              toast.error("Sign in as a learner to message instructors.");
              return;
            }
            setDmText("");
            setOpen("chat");
          }}
        >
          <MessageSquare className="h-4 w-4" /> Message
        </Pill>
      </div>

      <section className="px-5 pt-6">
        <h2 className="mb-2 text-sm font-semibold tracking-tight">About</h2>
        <Card className="p-4 text-sm leading-relaxed text-muted-foreground">{i.bio}</Card>
      </section>

      <section className="px-5 pt-6">
        <h2 className="mb-2 text-sm font-semibold tracking-tight">Reviews</h2>
        <div className="space-y-2">
          <Card className="p-4 text-sm text-muted-foreground">No reviews yet.</Card>
        </div>
      </section>

      <AnimatePresence>
        {open === "request" && (
          <Sheet
            onClose={() => {
              setOpen(null);
              setSent(false);
              setSlot(null);
            }}
          >
            {sent ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-foreground">
                  ✓
                </div>
                <h3 className="text-lg font-semibold">Request sent</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {i.fullName} will respond shortly.
                </p>
                <Pill
                  className="mt-6 w-full"
                  onClick={() => {
                    setOpen(null);
                    setSent(false);
                    setSlot(null);
                  }}
                >
                  Done
                </Pill>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold tracking-tight">Request a session</h3>
                <p className="mt-1 text-sm text-muted-foreground">Pick a time that works.</p>

                <p className="mt-5 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                  Date
                </p>
                <MiniCalendar />

                <p className="mt-5 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                  Time
                </p>
                <div className="flex flex-wrap gap-2">
                  {SLOTS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSlot(s)}
                      className={
                        "h-9 rounded-full border px-4 text-xs font-medium transition-colors " +
                        (slot === s
                          ? "bg-foreground text-background border-foreground"
                          : "border-hairline text-muted-foreground hover:text-foreground")
                      }
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  placeholder="Optional message"
                  className="mt-5 w-full resize-none rounded-xl border border-hairline bg-background p-3 text-sm outline-none focus:border-foreground"
                />
                <Pill className="mt-4 w-full" disabled={!slot} onClick={() => setSent(true)}>
                  Send request
                </Pill>
              </>
            )}
          </Sheet>
        )}

        {open === "chat" && (
          <Sheet onClose={() => !dmSending && setOpen(null)}>
            <h3 className="text-lg font-semibold tracking-tight">Message {i.fullName}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Your message opens in Messages so you can keep the conversation going.
            </p>
            <label
              htmlFor="instructor-dm"
              className="mt-5 mb-2 block text-[11px] uppercase tracking-widest text-muted-foreground"
            >
              Message
            </label>
            <Textarea
              id="instructor-dm"
              value={dmText}
              onChange={(e) => setDmText(e.target.value.slice(0, 2000))}
              placeholder={`Hi ${i.fullName.split(" ")[0] ?? "there"}, I'd like to …`}
              rows={4}
              disabled={dmSending}
              className="resize-none"
            />
            <p className="mt-1 text-right text-[10px] text-muted-foreground">
              {dmText.length} / 2000
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={dmSending}
                onClick={() => setOpen(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={dmSending || !dmText.trim()}
                onClick={() => void sendDm()}
              >
                {dmSending ? "Sending…" : "Send"}
              </Button>
            </div>
          </Sheet>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function MiniCalendar() {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, idx) => {
    const d = new Date(today);
    d.setDate(today.getDate() + idx);
    return d;
  });
  const [picked, setPicked] = useState(0);
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
      {days.map((d, idx) => {
        const active = idx === picked;
        return (
          <button
            key={idx}
            type="button"
            onClick={() => setPicked(idx)}
            className={
              "flex h-16 w-12 shrink-0 flex-col items-center justify-center rounded-xl border transition-colors " +
              (active
                ? "border-foreground bg-foreground text-background"
                : "border-hairline text-muted-foreground hover:text-foreground")
            }
          >
            <span className="text-[10px] uppercase tracking-widest">
              {d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3)}
            </span>
            <span className="mt-0.5 text-base font-semibold tabular-nums">{d.getDate()}</span>
          </button>
        );
      })}
    </div>
  );
}

function Sheet({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-2xl border border-b-0 border-hairline bg-surface p-6 shadow-elevated"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-accent" />
        {children}
      </motion.div>
    </>
  );
}
