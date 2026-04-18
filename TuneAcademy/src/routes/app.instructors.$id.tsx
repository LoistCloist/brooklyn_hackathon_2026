import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Card } from "@/components/tuneacademy/Card";
import { Avatar } from "@/components/tuneacademy/Avatar";
import { Pill } from "@/components/tuneacademy/Pill";
import { instructors, reviewsByInstructor } from "@/lib/mockData";
import { ArrowLeft, Star, MessageSquare, Calendar } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const Route = createFileRoute("/app/instructors/$id")({
  loader: ({ params }) => {
    const i = instructors.find((x) => x.id === params.id);
    if (!i) throw notFound();
    return i;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? "Instructor"} — TuneAcademy` }],
  }),
  component: InstructorProfile,
  notFoundComponent: () => (
    <AppShell>
      <div className="p-8 text-center text-sm text-muted-foreground">
        Instructor not found. <Link to="/app/instructors" className="underline">Back</Link>
      </div>
    </AppShell>
  ),
});

const SLOTS = ["9:00 AM", "11:00 AM", "2:00 PM", "5:00 PM"];

function InstructorProfile() {
  const i = Route.useLoaderData();
  const reviews = reviewsByInstructor[i.id] ?? [];
  const [open, setOpen] = useState<"request" | "chat" | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const nav = useNavigate();

  return (
    <AppShell>
      <header className="flex items-center justify-between px-5 pt-6">
        <button
          onClick={() => nav({ to: "/app/instructors" })}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      </header>

      <div className="flex flex-col items-center px-5 pt-6 text-center">
        <Avatar initials={i.avatar} size={88} className="text-2xl" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{i.name}</h1>
        <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <Star className="h-3.5 w-3.5 fill-foreground text-foreground" />
          <span className="tabular-nums text-foreground">{i.rating.toFixed(1)}</span>
          <span>· {i.reviewsCount} reviews · {i.yearsExp} yrs</span>
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {i.specialties.map((s: string) => (
            <span
              key={s}
              className="rounded-full border border-hairline px-2.5 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs font-medium">{i.hourlyRate === 0 ? "Free first lesson" : `$${i.hourlyRate}/hr`}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 px-5 pt-6">
        <Pill onClick={() => setOpen("request")}>
          <Calendar className="h-4 w-4" /> Request session
        </Pill>
        <Pill variant="secondary" onClick={() => setOpen("chat")}>
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
          {reviews.length === 0 && (
            <Card className="p-4 text-sm text-muted-foreground">No reviews yet.</Card>
          )}
          {reviews.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-center justify-between text-xs">
                <p className="font-medium text-foreground">{r.reviewer}</p>
                <p className="text-muted-foreground">{r.date}</p>
              </div>
              <div className="mt-1 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <Star
                    key={idx}
                    className={
                      "h-3 w-3 " + (idx < r.rating ? "fill-foreground text-foreground" : "text-muted-foreground")
                    }
                  />
                ))}
              </div>
              <p className="mt-2 text-sm">{r.comment}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Request session bottom sheet */}
      <AnimatePresence>
        {open === "request" && (
          <Sheet onClose={() => { setOpen(null); setSent(false); setSlot(null); }}>
            {sent ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-foreground">
                  ✓
                </div>
                <h3 className="text-lg font-semibold">Request sent</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {i.name} will respond shortly.
                </p>
                <Pill className="mt-6 w-full" onClick={() => { setOpen(null); setSent(false); setSlot(null); }}>
                  Done
                </Pill>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold tracking-tight">Request a session</h3>
                <p className="mt-1 text-sm text-muted-foreground">Pick a time that works.</p>

                <p className="mt-5 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Date</p>
                <MiniCalendar />

                <p className="mt-5 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Time</p>
                <div className="flex flex-wrap gap-2">
                  {SLOTS.map((s) => (
                    <button
                      key={s}
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
          <Sheet onClose={() => setOpen(null)}>
            <h3 className="text-lg font-semibold tracking-tight">Message {i.name}</h3>
            <div className="mt-4 space-y-2">
              <div className="rounded-2xl border border-hairline bg-background p-3 text-sm">
                Hi! Thanks for reaching out. When would you like to start?
              </div>
            </div>
            <input
              placeholder="Type a message…"
              className="mt-6 h-12 w-full rounded-full border border-hairline bg-background px-4 text-sm outline-none focus:border-foreground"
            />
          </Sheet>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

function MiniCalendar() {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });
  const [picked, setPicked] = useState(0);
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
      {days.map((d, i) => {
        const active = i === picked;
        return (
          <button
            key={i}
            onClick={() => setPicked(i)}
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
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-accent" />
        {children}
      </motion.div>
    </>
  );
}
