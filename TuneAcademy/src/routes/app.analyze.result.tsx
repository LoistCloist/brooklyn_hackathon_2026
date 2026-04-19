import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Avatar } from "@/components/tuneacademy/Avatar";
import { Card } from "@/components/tuneacademy/Card";
import { Pill } from "@/components/tuneacademy/Pill";
import { ScoreBar } from "@/components/tuneacademy/ScoreBar";
import { dimensionLabels } from "@/lib/mockData";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreUserDoc } from "@/hooks/useFirestoreUserDoc";
import { formatSpecialtyLabel, useInstructorsDirectory, type InstructorDirectoryRow } from "@/hooks/useInstructorsDirectory";
import { getFirestoreDb } from "@/lib/firebase";
import { specialtyToSlug } from "@/lib/tuneacademyFirestore";
import { ArrowLeft, ArrowRight, Mic, MicOff, Loader2, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ConversationProvider, useConversation } from "@elevenlabs/react";
import { doc, onSnapshot } from "firebase/firestore";

export const Route = createFileRoute("/app/analyze/result")({
   validateSearch: z.object({ reportId: z.string().optional() }),
   head: () => ({ meta: [{ title: "Your analysis – TuneAcademy" }] }),
   component: ResultPage,
});

function initialsFromName(name: string): string {
   const parts = name.trim().split(/\s+/).filter(Boolean);
   if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
   if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
   return (parts[0]?.[0] || "?").toUpperCase();
}

function learnerSkillLevelLabel(level: "beginner" | "intermediate" | "advanced"): string {
   if (level === "beginner") return "Beginner";
   if (level === "intermediate") return "Intermediate";
   return "Advanced";
}

function formatTeachingLevelBadge(slug: string): string {
   const s = slug.trim().toLowerCase();
   if (s === "beginner") return "Beginner";
   if (s === "intermediate") return "Intermediate";
   if (s === "advanced") return "Advanced";
   return formatSpecialtyLabel(slug);
}

/**
 * Demo-friendly matching: same instrument as this report, and/or teaches the learner's level.
 * Ranked so instrument + level wins, then instrument-only, then level-only.
 */
function getSuggestedInstructors(
   rows: InstructorDirectoryRow[],
   reportInstrument: string,
   learnerSkillLevel: "beginner" | "intermediate" | "advanced" | undefined,
   max: number,
): InstructorDirectoryRow[] {
   const slug = specialtyToSlug(reportInstrument);
   const noInstrument = !slug || slug === "unknown";

   const scored = rows.map((row) => {
      const hasInst =
         !noInstrument && row.doc.specialties.some((sp) => specialtyToSlug(sp) === slug);
      const hasLevel =
         Boolean(learnerSkillLevel) &&
         (row.doc.teachingLevels ?? []).some((l) => l.trim().toLowerCase() === learnerSkillLevel);
      let tier = 0;
      if (hasInst && hasLevel) tier = 3;
      else if (hasInst) tier = 2;
      else if (hasLevel) tier = 1;
      return { row, tier };
   });

   const sorted = scored
      .filter((x) => x.tier > 0)
      .sort((a, b) => {
         if (b.tier !== a.tier) return b.tier - a.tier;
         return b.row.doc.rating - a.row.doc.rating;
      })
      .map((x) => x.row);

   const dedup: InstructorDirectoryRow[] = [];
   const seen = new Set<string>();
   for (const r of sorted) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      dedup.push(r);
      if (dedup.length >= max) break;
   }
   return dedup;
}

function useCount(target: number, durationMs = 900) {
   const [n, setN] = useState(0);
   useEffect(() => {
      const start = performance.now();
      let raf = 0;
      const tick = (t: number) => {
         const p = Math.min(1, (t - start) / durationMs);
         const eased = 1 - Math.pow(1 - p, 3);
         setN(Math.round(target * eased));
         if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
   }, [target, durationMs]);
   return n;
}

type ReportData = {
   instrument: string;
   overallScore: number;
   dimensionScores: Record<string, number>;
   weaknesses: string[];
   status: string;
};

function ResultPage() {
   const nav = useNavigate();
   const { reportId } = Route.useSearch();
   const [report, setReport] = useState<ReportData | null>(null);
   const [loading, setLoading] = useState(true);
   const { user, userDoc } = useAuth();
   const { user: liveUserDoc } = useFirestoreUserDoc(user?.uid ?? null);
   const learnerProfile = liveUserDoc ?? userDoc;
   const learnerSkillLevel =
      learnerProfile?.role === "learner" ? learnerProfile.skillLevel : undefined;
   const { rows: instructorRows, loading: instructorsLoading, error: instructorsError } = useInstructorsDirectory();

   const suggestedInstructors = useMemo(() => {
      if (!report || report.status === "error") return [];
      return getSuggestedInstructors(instructorRows, report.instrument, learnerSkillLevel, 6);
   }, [instructorRows, report, learnerSkillLevel]);

   useEffect(() => {
      if (!reportId) {
         setLoading(false);
         return;
      }
      const db = getFirestoreDb();
      const unsub = onSnapshot(doc(db, "reports", reportId), (snap) => {
         if (!snap.exists()) return;
         const d = snap.data();
         if (d.status === "done" || d.status === "error") {
            setReport({
               instrument: d.instrument ?? "Unknown",
               overallScore: d.overallScore ?? 0,
               dimensionScores: d.dimensionScores ?? {},
               weaknesses: d.weaknesses ?? [],
               status: d.status,
            });
            setLoading(false);
         }
      });
      return unsub;
   }, [reportId]);

   const score = useCount(report?.overallScore ?? 0);

   if (loading) {
      return (
         <AppShell>
            <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4">
               <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
               <p className="text-sm text-muted-foreground">Analyzing your recording…</p>
            </div>
         </AppShell>
      );
   }

   if (!report || report.status === "error") {
      return (
         <AppShell>
            <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-8 text-center">
               <p className="text-lg font-semibold">Analysis unavailable</p>
               <p className="text-sm text-muted-foreground">Something went wrong. Try recording again.</p>
               <Pill size="lg" onClick={() => nav({ to: "/app/analyze" })}>
                  Try again
               </Pill>
            </div>
         </AppShell>
      );
   }

   return (
      <AppShell>
         <header className="flex items-center justify-between px-5 pt-6">
            <button
               onClick={() => nav({ to: "/app/analyze" })}
               className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline"
            >
               <ArrowLeft className="h-4 w-4" />
            </button>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Analysis</p>
            <div className="w-10" />
         </header>

         <motion.div
            className="px-5 pt-6 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
         >
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Overall score</p>
            <p className="mt-2 text-[96px] font-extrabold leading-none tracking-tighter tabular-nums">{score}</p>
            <p className="mt-1 text-xs text-muted-foreground">/ 100 · {report.instrument}</p>
         </motion.div>

         <section className="px-5 pt-8">
            <h2 className="mb-3 text-sm font-semibold tracking-tight">By dimension</h2>
            <Card className="space-y-4 p-5">
               {dimensionLabels.map((d) => (
                  <ScoreBar key={d.key} label={d.label} value={report.dimensionScores[d.key] ?? 0} animate />
               ))}
            </Card>
         </section>

         {report.weaknesses.length > 0 && (
            <section className="px-5 pt-6">
               <h2 className="mb-3 text-sm font-semibold tracking-tight">Weaknesses</h2>
               <Card className="p-5">
                  <ul className="space-y-2.5 text-sm">
                     {report.weaknesses.map((w, i) => (
                        <li key={i} className="flex gap-2">
                           <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground" />
                           <span>{w}</span>
                        </li>
                     ))}
                  </ul>
               </Card>
            </section>
         )}

         <div className="px-5 pt-6">
            <ConversationProvider>
               <TuneCoachCard />
            </ConversationProvider>
         </div>

         <section className="px-5 pt-8">
            <h2 className="mb-1 text-sm font-semibold tracking-tight">Suggested instructors based on your weaknesses</h2>
            <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
               Instructors here teach the same instrument as this take ({report.instrument})
               {learnerSkillLevel ? (
                  <>
                     {" "}
                     or list your level ({learnerSkillLevelLabel(learnerSkillLevel)}) in their profile.
                  </>
               ) : (
                  <> — add your skill level in profile setup to also match by level.</>
               )}
            </p>

            {instructorsLoading ? (
               <Card className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Finding instructors…
               </Card>
            ) : instructorsError ? (
               <Card className="p-5 text-center text-sm text-muted-foreground">{instructorsError}</Card>
            ) : suggestedInstructors.length === 0 ? (
               <Card className="p-5 text-center text-sm text-muted-foreground">
                  No directory matches for this instrument and level yet. You can still browse everyone.
               </Card>
            ) : (
               <div className="grid gap-3 sm:grid-cols-2">
                  {suggestedInstructors.map(({ id, doc: instructor }) => (
                     <Link
                        key={id}
                        to="/app/instructors/$id"
                        params={{ id }}
                        className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                     >
                        <Card className="flex gap-3 p-4 transition-colors hover:bg-muted/40">
                           <Avatar
                              initials={initialsFromName(instructor.fullName)}
                              src={instructor.avatarUrl}
                              size={52}
                              className="shrink-0"
                           />
                           <div className="min-w-0 flex-1 text-left">
                              <p className="truncate font-semibold leading-tight">{instructor.fullName}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                 {instructor.hourlyRate === 0 ? "Free" : `$${instructor.hourlyRate}/hr`}
                                 <span className="mx-1.5 text-muted-foreground/50">·</span>
                                 <span className="inline-flex items-center gap-0.5">
                                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                                    {instructor.rating.toFixed(1)}
                                 </span>
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1">
                                 {instructor.specialties.slice(0, 3).map((sp) => (
                                    <span
                                       key={sp}
                                       className="rounded-full border border-border bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                                    >
                                       {formatSpecialtyLabel(sp)}
                                    </span>
                                 ))}
                              </div>
                              {(instructor.teachingLevels ?? []).length > 0 && (
                                 <div className="mt-1.5 flex flex-wrap gap-1">
                                    {(instructor.teachingLevels ?? []).slice(0, 3).map((lvl) => (
                                       <span
                                          key={lvl}
                                          className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                                       >
                                          {formatTeachingLevelBadge(lvl)}
                                       </span>
                                    ))}
                                 </div>
                              )}
                           </div>
                        </Card>
                     </Link>
                  ))}
               </div>
            )}
         </section>

         <div className="px-5 pt-5 pb-10">
            <Link to="/app/instructors" className="block">
               <Pill size="lg" className="w-full">
                  Browse all instructors
                  <ArrowRight className="h-4 w-4" />
               </Pill>
            </Link>
         </div>
      </AppShell>
   );
}

function TuneCoachCard() {
   const conversation = useConversation({
      onConnect: () => console.log("TuneCoach connected"),
      onDisconnect: () => console.log("TuneCoach disconnected"),
      onError: (error) => console.error("TuneCoach error:", error),
   });

   const isConnected = conversation.status === "connected";
   const isConnecting = conversation.status === "connecting";

   const handleToggleCoach = async () => {
      if (isConnected) {
         conversation.endSession();
         return;
      }

      await navigator.mediaDevices.getUserMedia({ audio: true });
      conversation.startSession({ agentId: "agent_3001kph9exayf6etsbvvqm759djj" });
   };

   return (
      <Card className="p-5 text-center">
         <p className="mb-1 text-sm font-semibold">Talk to TuneCoach</p>
         <p className="mb-4 text-xs text-muted-foreground">
            {isConnected ? (conversation.isSpeaking ? "TuneCoach is speaking..." : "Listening...") : "Ask your AI coach about your results"}
         </p>
         <button
            onClick={handleToggleCoach}
            disabled={isConnecting}
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full transition-all ${
               isConnected ? "bg-red-500 text-white" : "bg-foreground text-background"
            }`}
         >
            {isConnecting ? (
               <Loader2 className="h-6 w-6 animate-spin" />
            ) : isConnected ? (
               <MicOff className="h-6 w-6" />
            ) : (
               <Mic className="h-6 w-6" />
            )}
         </button>
         {isConnected && <p className="mt-3 text-xs text-red-500">Tap to end session</p>}
      </Card>
   );
}
