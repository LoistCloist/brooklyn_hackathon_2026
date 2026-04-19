import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Pill } from "@/components/tuneacademy/Pill";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { demoMeetUri } from "@/lib/meetLinks";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { timestampToMillis } from "@/lib/scheduling";
import {
   recordMeetLinkOpened,
   subscribeMeetSession,
   type TutoringEngagementDoc,
   type TutoringMeetSessionDoc,
} from "@/lib/tutoringFirestore";
import { submitInstructorSessionReview } from "@/lib/tuneacademyFirestore";
import { cn } from "@/lib/utils";
import { Check, Clock, ExternalLink, ShieldCheck, Star, Video } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const searchSchema = z.object({
   engagementId: z.string().optional(),
   sessionIndex: z
      .union([z.string(), z.number()])
      .optional()
      .transform((v) => {
         if (v === undefined) return undefined;
         const n = typeof v === "number" ? v : Number.parseInt(String(v), 10);
         return Number.isFinite(n) ? n : undefined;
      }),
});

export const Route = createFileRoute("/app/meeting")({
   validateSearch: (raw) => searchSchema.parse(raw ?? {}),
   head: () => ({ meta: [{ title: "Live session — TuneAcademy" }] }),
   component: MeetingJoinPage,
});

function MeetingJoinPage() {
   const { engagementId: rawEngagementId, sessionIndex: rawSessionIndex } = Route.useSearch();
   const engagementId = rawEngagementId?.trim() ?? "";
   const sessionIndex = rawSessionIndex ?? 0;
   const { user } = useAuth();
   const [phase, setPhase] = useState<"load" | "bad" | "ready">("load");
   const [eng, setEng] = useState<TutoringEngagementDoc | null>(null);
   const [meetSess, setMeetSess] = useState<TutoringMeetSessionDoc | null>(null);
   const [opening, setOpening] = useState(false);
   const [stars, setStars] = useState(0);
   const [hoverRating, setHoverRating] = useState<number | null>(null);
   const [reviewText, setReviewText] = useState("");
   const [reviewBusy, setReviewBusy] = useState(false);
   const [alreadyReviewed, setAlreadyReviewed] = useState(false);

   useEffect(() => {
      setStars(0);
      setHoverRating(null);
      setReviewText("");
   }, [engagementId, sessionIndex]);

   useEffect(() => {
      if (!engagementId || !user) {
         setPhase("bad");
         return;
      }
      let cancelled = false;
      const db = getFirestoreDb();
      const unsub = onSnapshot(doc(db, "tutoringEngagements", engagementId), (snap) => {
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
      });
      return () => {
         cancelled = true;
         unsub();
      };
   }, [engagementId, user]);

   useEffect(() => {
      if (!engagementId || sessionIndex < 0) {
         setMeetSess(null);
         return () => {};
      }
      return subscribeMeetSession(engagementId, sessionIndex, setMeetSess);
   }, [engagementId, sessionIndex]);

   const role = useMemo<"learner" | "instructor" | null>(() => {
      if (!user || !eng) return null;
      if (eng.learnerId === user.uid) return "learner";
      if (eng.instructorId === user.uid) return "instructor";
      return null;
   }, [eng, user]);

   const meetLink = meetSess?.meetLink ?? demoMeetUri(engagementId, sessionIndex);
   const usingGoogleCalendarMeet = meetSess?.conferenceProvider === "google_calendar" || Boolean(meetSess?.googleCalendarEventId);

   const meetingWindow = useMemo(() => {
      if (!eng?.meetings[sessionIndex]) return null;
      const m = eng.meetings[sessionIndex]!;
      const s = timestampToMillis(m.startAt);
      const e = timestampToMillis(m.endAt);
      if (s == null || e == null) return null;
      return { start: new Date(s), end: new Date(e) };
   }, [eng, sessionIndex]);

   const sessionComplete = meetSess?.sessionCompletedAt != null;
   /** Hackathon demo: no calendar-window lock; join is always allowed for valid sessions. */
   const joinState = {
      label: "Ready to join",
      note: "Open through TuneAcademy so attendance and billing stay protected.",
   } as const;

   useEffect(() => {
      if (!user || !eng || role !== "learner" || !sessionComplete) {
         setAlreadyReviewed(false);
         return;
      }
      const reviewId = `${user.uid}_${engagementId}_${String(Math.floor(sessionIndex))}`;
      let cancelled = false;
      void getDoc(doc(getFirestoreDb(), "instructors", eng.instructorId, "receivedReviews", reviewId)).then((snap) => {
         if (!cancelled) setAlreadyReviewed(snap.exists());
      });
      return () => {
         cancelled = true;
      };
   }, [user, eng, role, sessionComplete, engagementId, sessionIndex]);

   async function onOpenMeet() {
      if (!user || !role) return;
      setOpening(true);
      try {
         const res = await recordMeetLinkOpened({ uid: user.uid, engagementId, sessionIndex, role });
         if (res === "completed") {
            toast.success("Session complete — both joined the Meet link.");
         } else if (res === "recorded") {
            toast.message("Marked you as joined.");
         }
         window.open(meetLink, "_blank", "noopener,noreferrer");
      } catch (e) {
         toast.error(e instanceof Error ? e.message : "Could not update session.");
      } finally {
         setOpening(false);
      }
   }

   async function onSubmitReview() {
      if (!user || !eng || stars < 1) {
         toast.error("Pick a star rating.");
         return;
      }
      setReviewBusy(true);
      try {
         await submitInstructorSessionReview({
            instructorId: eng.instructorId,
            learnerId: user.uid,
            engagementId,
            sessionIndex,
            stars,
            reviewText,
         });
         toast.success("Thanks for your feedback!");
         setAlreadyReviewed(true);
      } catch (e) {
         toast.error(e instanceof Error ? e.message : "Could not save review.");
      } finally {
         setReviewBusy(false);
      }
   }

   if (phase === "load") {
      return (
         <AppShell>
            <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">Loading…</div>
         </AppShell>
      );
   }

   if (phase === "bad") {
      return (
         <AppShell>
            <div className="mx-auto max-w-md px-6 py-16 text-center">
               <p className="text-lg font-semibold">Session not found</p>
               <p className="mt-2 text-sm text-muted-foreground">This link may be invalid, or you do not have access.</p>
               <Link to="/app">
                  <Pill className="mt-6">Back home</Pill>
               </Link>
            </div>
         </AppShell>
      );
   }

   const idxErr = eng && (sessionIndex < 0 || sessionIndex >= eng.meetings.length);

   return (
      <AppShell>
         <div className="mx-auto max-w-lg px-5 py-10">
            <Link to="/app" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
               ← Home
            </Link>

            {idxErr ? (
               <div className="mt-10 text-center">
                  <p className="text-lg font-semibold">Invalid session</p>
                  <p className="mt-2 text-sm text-muted-foreground">This engagement does not have that session index.</p>
                  <Link to="/app" className="mt-6 inline-block">
                     <Pill variant="secondary">Go back</Pill>
                  </Link>
               </div>
            ) : meetSess?.cancelledAt ? (
               <div className="mt-10 space-y-5 text-center">
                  <p className="text-lg font-semibold">Meeting cancelled</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                     This session was cancelled on both sides. Open your profile to see what’s still on your calendar.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                     <Link to="/app/profile">
                        <Pill>Profile & schedule</Pill>
                     </Link>
                     <Link to="/app">
                        <Pill variant="secondary">Home</Pill>
                     </Link>
                  </div>
               </div>
            ) : (
               <div className="mt-8 space-y-6">
                  <div className="text-center">
                     <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-hairline bg-muted/30">
                        <Video className="h-7 w-7 text-foreground" />
                     </div>
                     <h1 className="mt-4 text-2xl font-black tracking-tight">Google Meet session</h1>
                     <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        TuneAcademy opens the Meet room through this page only (the URL is not shown here). The session is counted complete
                        once <span className="font-semibold text-foreground">both</span> the student and instructor join through this page.
                     </p>
                  </div>

                  {meetingWindow ? (
                     <div className="rounded-xl border border-hairline bg-surface/80 px-4 py-3 text-center text-sm">
                        <p className="font-semibold text-foreground">Scheduled window</p>
                        <p className="mt-1 text-muted-foreground">
                           {meetingWindow.start.toLocaleString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                           })}{" "}
                           – {meetingWindow.end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </p>
                     </div>
                  ) : null}

                  <div className="space-y-4 rounded-2xl border border-hairline bg-surface p-5 shadow-elevated">
                     <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                           <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Protected Meet room</p>
                           <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                              The raw Google Meet URL stays hidden. For this demo build, Join is available anytime before the session is
                              cancelled.
                           </p>
                        </div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                           <ShieldCheck className="h-3.5 w-3.5" />
                           {joinState.label}
                        </span>
                     </div>
                     <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm font-semibold text-foreground">Meet opens when you tap Join</div>
                     <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        {joinState.note}
                     </p>
                     <div className="flex flex-wrap gap-2">
                        <Button type="button" className="gap-2" onClick={() => void onOpenMeet()} disabled={opening}>
                           <ExternalLink className="h-4 w-4" />
                           {opening ? "Opening..." : "Join through TuneAcademy"}
                        </Button>
                     </div>
                     <p className="text-xs text-muted-foreground">
                        {usingGoogleCalendarMeet
                           ? "This session uses a Google Calendar-created Meet link behind the protected Join button."
                           : "Demo mode is active until the instructor connects Google Calendar."}
                     </p>
                  </div>

                  <div className="grid gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm">
                     <p className="flex items-center gap-2 font-black text-emerald-700 dark:text-emerald-300">
                        <ShieldCheck className="h-4 w-4" />
                        Leakage Shield
                     </p>
                     <p className="text-muted-foreground">Meet link not shown on this page</p>
                     <p className="text-muted-foreground">No copy-link sharing from the session page</p>
                     <p className="text-muted-foreground">Attendance tracked before budget is charged</p>
                  </div>

                  <div className="grid gap-2 rounded-xl border border-hairline bg-muted/20 px-4 py-3 text-sm">
                     <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Student opened link</span>
                        {meetSess?.learnerOpenedAt ? (
                           <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                              <Check className="h-4 w-4" /> Yes
                           </span>
                        ) : (
                           <span className="font-medium text-muted-foreground">Not yet</span>
                        )}
                     </div>
                     <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">Instructor opened link</span>
                        {meetSess?.instructorOpenedAt ? (
                           <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                              <Check className="h-4 w-4" /> Yes
                           </span>
                        ) : (
                           <span className="font-medium text-muted-foreground">Not yet</span>
                        )}
                     </div>
                     {sessionComplete ? (
                        <p className="pt-1 text-center text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                           Session complete — tutoring time will count toward budget.
                        </p>
                     ) : null}
                  </div>

                  {role === "learner" && sessionComplete && !alreadyReviewed ? (
                     <div className="space-y-4 rounded-2xl border border-transparent bg-[linear-gradient(135deg,#ffd666,rgba(255,214,102,0.5))] p-5 text-[#11140c] shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
                        <div className="flex items-center gap-2">
                           <Star className="h-5 w-5 fill-[#11140c]/90 text-[#11140c]/90" strokeWidth={0} />
                           <p className="text-sm font-black uppercase tracking-widest">Rate this session</p>
                        </div>
                        <p className="text-sm font-semibold text-[#11140c]/75">Tap the stars to fill them in — 1 is lowest, 5 is best.</p>
                        <div
                           className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:gap-4"
                           onMouseLeave={() => setHoverRating(null)}
                        >
                           <div
                              className="flex gap-0.5 rounded-xl border border-[#11140c]/12 bg-[#11140c]/10 p-2"
                              role="radiogroup"
                              aria-label="Rate this session from 1 to 5 stars"
                           >
                              {[1, 2, 3, 4, 5].map((n) => {
                                 const display = hoverRating ?? stars;
                                 const filled = n <= display;
                                 return (
                                    <button
                                       key={n}
                                       type="button"
                                       role="radio"
                                       aria-checked={stars === n}
                                       aria-label={`${n} out of 5 stars`}
                                       className={cn(
                                          "rounded-lg p-1.5 outline-none transition hover:scale-110 focus-visible:ring-2 focus-visible:ring-[#11140c]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#ffd666]/30",
                                          stars === n && "ring-2 ring-[#11140c]/35 ring-offset-2 ring-offset-[#fffdf5]/50",
                                       )}
                                       onMouseEnter={() => setHoverRating(n)}
                                       onFocus={() => setHoverRating(n)}
                                       onBlur={() => setHoverRating(null)}
                                       onClick={() => {
                                          setStars(n);
                                          setHoverRating(null);
                                       }}
                                    >
                                       <Star
                                          className={cn(
                                             "h-11 w-11 shrink-0 transition-colors",
                                             filled ? "fill-[#11140c] text-[#11140c]" : "fill-transparent text-[#11140c]/28",
                                          )}
                                          strokeWidth={filled ? 0 : 1.4}
                                          aria-hidden
                                       />
                                    </button>
                                 );
                              })}
                           </div>
                           <p className="min-w-[5rem] text-center text-lg font-black tabular-nums text-[#11140c] sm:text-left">
                              {stars > 0 ? `${stars} / 5` : "— / 5"}
                           </p>
                        </div>
                        <Textarea
                           placeholder="Optional feedback for your instructor…"
                           value={reviewText}
                           onChange={(e) => setReviewText(e.target.value)}
                           className="min-h-[100px] border-[#11140c]/20 bg-white/90 text-[#11140c] placeholder:text-[#11140c]/45"
                        />
                        <Button
                           type="button"
                           className="w-full bg-[#11140c] text-[#ffd666] hover:bg-[#11140c]/90"
                           disabled={reviewBusy || stars < 1}
                           onClick={() => void onSubmitReview()}
                        >
                           {reviewBusy ? "Sending…" : "Submit review"}
                        </Button>
                     </div>
                  ) : null}

                  {role === "learner" && sessionComplete && alreadyReviewed ? (
                     <p className="text-center text-sm font-semibold text-muted-foreground">
                        Thanks — your review was submitted for this session.
                     </p>
                  ) : null}
               </div>
            )}
         </div>
      </AppShell>
   );
}
