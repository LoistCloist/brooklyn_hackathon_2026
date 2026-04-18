import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Pill } from "@/components/tuneacademy/Pill";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { timestampToMillis } from "@/lib/scheduling";
import type { TutoringEngagementDoc } from "@/lib/tutoringFirestore";
import { Video } from "lucide-react";
import { useEffect, useState } from "react";

const searchSchema = z.object({
  engagementId: z.string().optional(),
});

export const Route = createFileRoute("/app/meeting")({
  validateSearch: (raw) => searchSchema.parse(raw ?? {}),
  head: () => ({ meta: [{ title: "Live session — TuneAcademy" }] }),
  component: MeetingJoinPage,
});

function MeetingJoinPage() {
  const { engagementId } = Route.useSearch();
  const id = engagementId?.trim() ?? "";
  const { user } = useAuth();
  const [phase, setPhase] = useState<"load" | "bad" | "ready">("load");
  const [eng, setEng] = useState<TutoringEngagementDoc | null>(null);
  const [mode, setMode] = useState<"early" | "live" | "ended">("ended");
  const [windowTimes, setWindowTimes] = useState<{ start: Date; end: Date } | null>(null);

  useEffect(() => {
    if (!id || !user) {
      setPhase("bad");
      return;
    }
    let cancelled = false;
    void (async () => {
      const snap = await getDoc(doc(getFirestoreDb(), "tutoringEngagements", id));
      if (cancelled) return;
      if (!snap.exists()) {
        setPhase("bad");
        return;
      }
      const data = snap.data() as TutoringEngagementDoc;
      if (data.learnerId !== user.uid && data.instructorId !== user.uid) {
        setPhase("bad");
        return;
      }
      setEng(data);
      setPhase("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  useEffect(() => {
    if (!eng || phase !== "ready") return;
    const meetings = eng.meetings;

    function tick() {
      const now = Date.now();
      const upcoming = meetings
        .map((m) => {
          const s = timestampToMillis(m.startAt);
          const e = timestampToMillis(m.endAt);
          if (s == null || e == null) return null;
          return { start: s, end: e };
        })
        .filter((m): m is { start: number; end: number } => m != null && m.end > now)
        .sort((a, b) => a.start - b.start);
      const next = upcoming[0];
      if (!next) {
        setMode("ended");
        setWindowTimes(null);
        return;
      }
      setWindowTimes({ start: new Date(next.start), end: new Date(next.end) });
      if (now < next.start) setMode("early");
      else setMode("live");
    }

    tick();
    const handle = window.setInterval(tick, 1000);
    return () => window.clearInterval(handle);
  }, [eng, phase]);

  if (phase === "load") {
    return (
      <AppShell>
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
          Loading…
        </div>
      </AppShell>
    );
  }

  if (phase === "bad") {
    return (
      <AppShell>
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <p className="text-lg font-semibold">Session not found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This link may be invalid, or you do not have access.
          </p>
          <Link to="/app">
            <Pill className="mt-6">Back home</Pill>
          </Link>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-md px-5 py-10">
        <Link to="/app" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
          ← Home
        </Link>

        {mode === "ended" ? (
          <div className="mt-10 text-center">
            <p className="text-lg font-semibold">No upcoming meetings</p>
            <p className="mt-2 text-sm text-muted-foreground">
              This tutoring series has no future sessions left on the calendar.
            </p>
            <Link to="/app" className="mt-6 inline-block">
              <Pill variant="secondary">Go back</Pill>
            </Link>
          </div>
        ) : mode === "early" && windowTimes ? (
          <div className="mt-10 rounded-2xl border border-hairline bg-surface p-8 text-center shadow-elevated">
            <p className="text-lg font-semibold tracking-tight">Meeting has not started</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Your next window opens{" "}
              <span className="font-medium text-foreground">
                {windowTimes.start.toLocaleString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
              .
            </p>
            <Link to="/app" className="mt-8 inline-block">
              <Pill variant="secondary">Go back</Pill>
            </Link>
          </div>
        ) : mode === "live" && windowTimes ? (
          <div className="mt-10 space-y-5 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-hairline bg-muted/30">
              <Video className="h-7 w-7 text-foreground" />
            </div>
            <p className="text-lg font-semibold tracking-tight">You are in the live window</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Built-in video is not wired up yet. For the hackathon demo, imagine a Google Meet–style
              room here; we will hook a provider in next.
            </p>
            <p className="text-xs text-muted-foreground">
              Ends{" "}
              {windowTimes.end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
            </p>
            <Link to="/app">
              <Pill className="mt-4" variant="secondary">
                Leave
              </Pill>
            </Link>
          </div>
        ) : (
          <div className="mt-10 text-center text-sm text-muted-foreground">Preparing session…</div>
        )}
      </div>
    </AppShell>
  );
}
