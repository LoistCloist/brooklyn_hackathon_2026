import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { collection, getDocs, limit, onSnapshot, orderBy, query, Timestamp, where } from "firebase/firestore";
import { ArrowLeft, BarChart3, CalendarDays, Film, MessageSquare, Music2, Sparkles, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { RecruitDialog } from "@/components/musireels/RecruitDialog";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { LearnerPosterMessageDialog } from "@/components/tuneacademy/LearnerPosterMessageDialog";
import { ProfileReceipts } from "@/components/tuneacademy/ProfileReceipts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreUserDoc } from "@/hooks/useFirestoreUserDoc";
import { getFirestoreDb } from "@/lib/firebase";
import { firestoreLikeToMillisOrZero } from "@/lib/firestoreTime";
import type { Reel } from "@/types";

const learnerSearchSchema = z.object({ displayName: z.string().optional(), avatarUrl: z.string().optional() });

export const Route = createFileRoute("/app/learner/$userId")({
   validateSearch: (raw) => learnerSearchSchema.parse(raw),
   head: () => ({ meta: [{ title: "Learner Profile - TuneAcademy" }] }),
   component: LearnerProfile,
});

function coerceCreatedAtToDate(ts: unknown): Date | null {
   if (ts == null) return null;
   if (ts instanceof Timestamp) {
      const d = ts.toDate();
      return Number.isNaN(d.getTime()) ? null : d;
   }
   if (ts instanceof Date) return Number.isNaN(ts.getTime()) ? null : ts;
   if (typeof ts === "number" && Number.isFinite(ts)) {
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? null : d;
   }
   if (typeof ts === "string") {
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? null : d;
   }
   if (typeof ts === "object") {
      const o = ts as Record<string, unknown>;
      if (typeof o.toDate === "function") {
         try {
            const d = (o.toDate as (this: typeof o) => Date).call(o);
            return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
         } catch {
            return null;
         }
      }
      const sec = typeof o.seconds === "number" ? o.seconds : typeof o._seconds === "number" ? o._seconds : null;
      if (sec != null) {
         const ns = typeof o.nanoseconds === "number" ? o.nanoseconds : typeof o._nanoseconds === "number" ? o._nanoseconds : 0;
         return new Date(sec * 1000 + ns / 1e6);
      }
   }
   return null;
}

function formatAccountCreatedAt(ts: unknown): string {
   const d = coerceCreatedAtToDate(ts);
   if (!d) return "-";
   return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function titleCase(value: string): string {
   return value.charAt(0).toUpperCase() + value.slice(1);
}

type ReportRow = { instrument?: string; overallScore?: number; weaknesses?: string[] };

function LearnerProfile() {
   const { userId } = Route.useParams();
   const search = Route.useSearch();
   const { user, userDoc } = useAuth();
   const { user: liveSelf } = useFirestoreUserDoc(user?.uid ?? null);
   const { user: profile, loading: profileLoading } = useFirestoreUserDoc(userId);
   const viewerRole = liveSelf?.role ?? userDoc?.role;
   const isInstructor = viewerRole === "instructor";
   const isLearnerViewer = viewerRole === "learner";
   const isOwn = user?.uid === userId;
   const nav = useNavigate();

   const [report, setReport] = useState<ReportRow | null>(null);
   const [reels, setReels] = useState<Reel[]>([]);
   const [reportLoading, setReportLoading] = useState(true);
   const [recruitOpen, setRecruitOpen] = useState(false);
   const [inviteReel, setInviteReel] = useState<Reel | null>(null);
   const [messageOpen, setMessageOpen] = useState(false);

   useEffect(() => {
      let cancelled = false;
      const run = async () => {
         setReportLoading(true);
         try {
            const db = getFirestoreDb();
            const repQuery = query(collection(db, "reports"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(1));
            const repSnap = await getDocs(repQuery);
            if (!cancelled) setReport(repSnap.empty ? null : (repSnap.docs[0].data() as ReportRow));
         } catch {
            if (!cancelled) setReport(null);
         } finally {
            if (!cancelled) setReportLoading(false);
         }
      };
      void run();
      return () => {
         cancelled = true;
      };
   }, [userId]);

   useEffect(() => {
      const db = getFirestoreDb();
      const q = query(collection(db, "reels"), where("uploaderId", "==", userId));
      return onSnapshot(q, (snap) => {
         const list: Reel[] = snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
               id: d.id,
               uploaderId: String(data.uploaderId ?? ""),
               uploaderName: String(data.uploaderName ?? ""),
               uploaderAvatarUrl: String(data.uploaderAvatarUrl ?? ""),
               instrument: String(data.instrument ?? ""),
               videoUrl: String(data.videoUrl ?? ""),
               thumbnailUrl: String(data.thumbnailUrl ?? ""),
               caption: String(data.caption ?? ""),
               likesCount: typeof data.likesCount === "number" ? data.likesCount : 0,
               commentsCount: typeof data.commentsCount === "number" ? data.commentsCount : 0,
               likedBy: Array.isArray(data.likedBy) ? (data.likedBy as string[]) : [],
               createdAt: data.createdAt as Reel["createdAt"],
            };
         });
         list.sort((a, b) => firestoreLikeToMillisOrZero(b.createdAt) - firestoreLikeToMillisOrZero(a.createdAt));
         setReels(list);
      });
   }, [userId]);

   const instruments = useMemo(() => {
      const set = new Set<string>();
      reels.forEach((r) => {
         if (r.instrument) set.add(r.instrument);
      });
      return [...set];
   }, [reels]);
   const totalReelLikes = useMemo(() => reels.reduce((sum, reel) => sum + reel.likesCount, 0), [reels]);

   const displayName = profile?.fullName?.trim() || search.displayName?.trim() || "Profile";
   const posterRole = profile?.role ?? "learner";
   const avatarSrc = profile?.avatarUrl?.trim() || search.avatarUrl?.trim() || "";
   const accountCreatedLabel = formatAccountCreatedAt(profile?.createdAt);
   const weaknesses = (report?.weaknesses ?? []).slice(0, 3);
   const pageLoading = profileLoading || reportLoading;
   const primaryInstrument = instruments[0] ? titleCase(instruments[0]) : "No instrument yet";

   const openReel = useCallback(
      (reel: Reel) => {
         void nav({ to: "/app/musireels", search: { reel: reel.id } });
      },
      [nav],
   );

   if (pageLoading) {
      return (
         <AppShell>
            <div className="flex min-h-[50vh] items-center justify-center text-sm font-semibold text-[#e8f4df]/55">Loading...</div>
         </AppShell>
      );
   }

   return (
      <AppShell>
         <div className="mx-auto max-w-6xl pb-28 pt-8">
            <Link
               to="/app/students"
               search={{ tab: "explore" }}
               className="inline-flex items-center gap-2 text-sm font-bold text-[#e8f4df]/65 transition hover:text-[#ffd666]"
            >
               <ArrowLeft className="h-4 w-4" />
               Students
            </Link>

            <section className="mt-6 overflow-hidden rounded-xl border border-[#fffdf5]/16 bg-[#fffdf5]/8 backdrop-blur">
               <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="p-6 sm:p-8">
                     <p className="text-xs font-black uppercase tracking-[0.22em] text-[#a6eee3]">Learner profile</p>
                     <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
                        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0e3a20] text-3xl font-black text-[#fffdf5] ring-2 ring-[#ffd666]/45">
                           {avatarSrc ? (
                              <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
                           ) : (
                              (displayName[0] ?? "?").toUpperCase()
                           )}
                        </div>
                        <div className="min-w-0">
                           <h1 className="text-3xl font-black tracking-tight text-[#fffdf5] md:text-4xl">{displayName}</h1>
                           <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-[#e8f4df]/62">
                              <CalendarDays className="h-4 w-4 text-[#ffd666]" />
                              {accountCreatedLabel === "-" ? "Account creation date unavailable" : `Joined ${accountCreatedLabel}`}
                           </p>
                           <div className="mt-4 flex flex-wrap gap-2">
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#a6eee3]/25 bg-[#a6eee3]/10 px-3 py-1 text-xs font-black text-[#a6eee3]">
                                 <Music2 className="h-3.5 w-3.5" />
                                 {primaryInstrument}
                              </span>
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#ffd666]/25 bg-[#ffd666]/10 px-3 py-1 text-xs font-black text-[#ffd666]">
                                 <Film className="h-3.5 w-3.5" />
                                 {reels.length} reel{reels.length === 1 ? "" : "s"}
                              </span>
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#fffdf5]/14 bg-[#fffdf5]/8 px-3 py-1 text-xs font-black text-[#e8f4df]/75">
                                 <Sparkles className="h-3.5 w-3.5" />
                                 {totalReelLikes} like{totalReelLikes === 1 ? "" : "s"}
                              </span>
                           </div>
                        </div>
                     </div>

                     <div className="mt-7 border-t border-[#fffdf5]/10 pt-5">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd666]">About</p>
                        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#e8f4df]/72">
                           {profile?.bio?.trim() || "This learner has not added a bio yet."}
                        </p>
                     </div>
                  </div>

                  <aside className="border-t border-[#fffdf5]/10 bg-[#0b1510]/50 p-6 sm:p-8 lg:border-l lg:border-t-0">
                     <p className="text-xs font-black uppercase tracking-[0.22em] text-[#ffd666]">Next action</p>
                     <p className="mt-3 text-sm leading-relaxed text-[#e8f4df]/65">
                        Review their work, then send a protected message or invitation through TuneAcademy.
                     </p>
                     {isOwn ? (
                        <Button
                           type="button"
                           className="mt-6 w-full rounded-lg bg-[#ffd666] text-[#11140c] hover:bg-[#ffd666]/90"
                           onClick={() => void nav({ to: "/app/profile", search: { editBio: "1" } })}
                        >
                           Edit profile
                        </Button>
                     ) : isInstructor ? (
                        <Button
                           type="button"
                           className="mt-6 w-full rounded-lg bg-[#ffd666] text-[#11140c] hover:bg-[#ffd666]/90"
                           onClick={() => {
                              const reel = reels[0];
                              if (!reel) {
                                 toast.error("This learner has no reels to attach to an invitation.");
                                 return;
                              }
                              setInviteReel(reel);
                              setRecruitOpen(true);
                           }}
                        >
                           <UserPlus className="mr-2 h-4 w-4" />
                           Recruit learner
                        </Button>
                     ) : isLearnerViewer && user ? (
                        <Button
                           type="button"
                           variant="outline"
                           className="mt-6 w-full rounded-lg border-[#a6eee3]/35 text-[#a6eee3] hover:bg-[#a6eee3]/10"
                           onClick={() => setMessageOpen(true)}
                        >
                           <MessageSquare className="mr-2 h-4 w-4" />
                           Send message
                        </Button>
                     ) : null}
                  </aside>
               </div>
            </section>

            {isOwn ? (
               <div className="mt-6">
                  <ProfileReceipts viewerUid={userId} viewerRole="learner" />
               </div>
            ) : null}

            <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
               <section className="rounded-xl border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-6">
                  <div className="flex items-center justify-between gap-4">
                     <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a6eee3]">Analysis</p>
                        <h2 className="mt-2 text-xl font-black text-[#fffdf5]">Latest report</h2>
                     </div>
                     <BarChart3 className="h-8 w-8 text-[#a6eee3]" />
                  </div>
                  {report ? (
                     <div className="mt-5">
                        <div className="flex items-end gap-2">
                           <span className="text-5xl font-black text-[#ffd666]">
                              {typeof report.overallScore === "number" ? report.overallScore : "-"}
                           </span>
                           <span className="pb-1 text-sm font-bold text-[#e8f4df]/50">/100</span>
                        </div>
                        <p className="mt-3 text-sm font-bold capitalize text-[#e8f4df]/70">{String(report.instrument ?? "Instrument")}</p>
                        {weaknesses.length ? (
                           <div className="mt-5 space-y-2">
                              {weaknesses.map((weakness, index) => (
                                 <div
                                    key={`${index}-${weakness.slice(0, 20)}`}
                                    className="rounded-lg border border-[#fffdf5]/10 bg-[#0b1510]/45 px-3 py-2 text-sm text-[#e8f4df]/70"
                                 >
                                    {weakness}
                                 </div>
                              ))}
                           </div>
                        ) : null}
                     </div>
                  ) : (
                     <p className="mt-6 rounded-lg border border-[#fffdf5]/10 bg-[#0b1510]/45 px-4 py-5 text-sm font-semibold text-[#e8f4df]/55">
                        No analysis report on file.
                     </p>
                  )}
               </section>

               <section className="rounded-xl border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-6">
                  <div className="flex items-center justify-between gap-4">
                     <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ffd666]">Portfolio</p>
                        <h2 className="mt-2 text-xl font-black text-[#fffdf5]">Their reels</h2>
                     </div>
                     <Film className="h-8 w-8 text-[#ffd666]" />
                  </div>
                  {reels.length === 0 ? (
                     <p className="mt-6 rounded-lg border border-[#fffdf5]/10 bg-[#0b1510]/45 px-4 py-5 text-sm font-semibold text-[#e8f4df]/55">
                        No reels yet.
                     </p>
                  ) : (
                     <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                        {reels.map((reel) => (
                           <button
                              key={reel.id}
                              type="button"
                              onClick={() => openReel(reel)}
                              className="group relative aspect-[9/14] overflow-hidden rounded-lg border border-[#fffdf5]/12 bg-[#0b1510]/60 text-left transition hover:border-[#ffd666]/45"
                           >
                              {reel.thumbnailUrl ? (
                                 <img
                                    src={reel.thumbnailUrl}
                                    alt=""
                                    className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                                 />
                              ) : null}
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#07100c] to-transparent p-3">
                                 <p className="truncate text-xs font-black capitalize text-[#fffdf5]">{reel.instrument || "Reel"}</p>
                                 {reel.caption ? (
                                    <p className="mt-1 line-clamp-2 text-[11px] font-semibold text-[#e8f4df]/65">{reel.caption}</p>
                                 ) : null}
                              </div>
                           </button>
                        ))}
                     </div>
                  )}
               </section>
            </div>

            {inviteReel && user ? (
               <RecruitDialog
                  open={recruitOpen}
                  onOpenChange={(open) => {
                     setRecruitOpen(open);
                     if (!open) setInviteReel(null);
                  }}
                  reel={inviteReel}
                  instructorId={user.uid}
                  instructorName={userDoc?.fullName?.trim() || user.displayName || "Instructor"}
                  onSent={() => {
                     setRecruitOpen(false);
                     setInviteReel(null);
                  }}
               />
            ) : null}

            {user && isLearnerViewer && !isOwn ? (
               <LearnerPosterMessageDialog
                  open={messageOpen}
                  onOpenChange={setMessageOpen}
                  learnerId={user.uid}
                  learnerName={userDoc?.fullName?.trim() || user.displayName || "Learner"}
                  posterId={userId}
                  posterName={displayName}
                  posterRole={posterRole}
               />
            ) : null}
         </div>
      </AppShell>
   );
}
