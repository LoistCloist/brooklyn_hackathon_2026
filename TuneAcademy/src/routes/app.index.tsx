import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Avatar } from "@/components/tuneacademy/Avatar";
import { Pill } from "@/components/tuneacademy/Pill";
import { useAuth } from "@/contexts/AuthContext";
import {
   getUserDoc,
   subscribeInstructorDoc,
   subscribeLatestReceivedReviewStars,
   type InstructorFirestoreDoc,
} from "@/lib/tuneacademyFirestore";
import { timestampToMillis } from "@/lib/scheduling";
import { brandTheme } from "@/lib/theme";
import { subscribeEngagementsForUser, subscribePendingRequestCount, type TutoringEngagementDoc } from "@/lib/tutoringFirestore";
import { useNextJoinableHomeMeeting } from "@/hooks/useNextJoinableHomeMeeting";
import { useFirestoreUserDoc } from "@/hooks/useFirestoreUserDoc";
import { ArrowRight, Bell, CalendarDays, DollarSign, Flame, LogOut, Mic, Sparkles, Star, TrendingUp, Trophy, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

function initialsFromProfile(fullName: string | undefined, email: string | undefined): string {
   const name = fullName?.trim();
   if (name) {
      const parts = name.split(/\s+/).filter(Boolean);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return `${parts[0][0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase() || "TA";
   }
   const local = email?.split("@")[0]?.trim();
   if (local && local.length >= 2) return local.slice(0, 2).toUpperCase();
   if (local?.[0]) return local[0].toUpperCase();
   return "TA";
}

export const Route = createFileRoute("/app/")({ head: () => ({ meta: [{ title: "Home - TuneAcademy" }] }), component: HomeTab });

const placeholderStats = [
   { label: "Practice streak", value: "6", suffix: "days" },
   { label: "Latest score", value: "82", suffix: "/100" },
   { label: "Focus", value: "Timing", suffix: "" },
];

const focusTargets = [
   { label: "Lock in rests before fast runs", tag: "Rhythm", color: "bg-[#ff6b6b]" },
   { label: "Keep pitch centered on sustained notes", tag: "Pitch", color: "bg-[#ffd666]" },
   { label: "Smooth attack on the first beat", tag: "Tone", color: "bg-[#2fc5b5]" },
];

const progressBars = [
   { label: "Rhythm", value: 78, color: "bg-[#ff6b6b]" },
   { label: "Pitch center", value: 84, color: "bg-[#ffd666]" },
   { label: "Dynamics", value: 69, color: "bg-[#2fc5b5]" },
];

const learnerHeroGlow = {
   size: "40rem",
   right: "-14rem",
   top: "-16rem",
   blur: "1px",
   centerOpacity: 0.2,
   edgeOpacity: 0.09,
   edgeStart: "38%",
   fadeOut: "70%",
};

function InstructorStarRow({ stars }: { stars: number }) {
   return (
      <div className="mt-6 flex gap-1" aria-label={`${stars} out of 5 stars`}>
         {Array.from({ length: 5 }, (_, i) =>
            i < stars ? (
               <Star key={i} className="h-8 w-8 fill-[#ffd666] text-[#ffd666]" strokeWidth={0} />
            ) : (
               <Star key={i} className="h-8 w-8 text-[#fffdf5]/22" strokeWidth={1.5} />
            ),
         )}
      </div>
   );
}

function HomeTab() {
   const nav = useNavigate();
   const { user, userDoc, signOutUser } = useAuth();
   const initials = initialsFromProfile(userDoc?.fullName, userDoc?.email);
   const isInstructor = userDoc?.role === "instructor";
   const [pendingCount, setPendingCount] = useState(0);
   const [engagementRows, setEngagementRows] = useState<{ id: string; data: TutoringEngagementDoc }[]>([]);
   const [instructorDocSnap, setInstructorDocSnap] = useState<InstructorFirestoreDoc | null>(null);
   const [latestReviewStars, setLatestReviewStars] = useState<number | null>(null);
   const [leaderboardNames, setLeaderboardNames] = useState<Record<string, string>>({});
   const { user: liveProfileDoc } = useFirestoreUserDoc(user?.uid && userDoc?.role === "learner" ? user.uid : null);

   useEffect(() => {
      return subscribePendingRequestCount(isInstructor ? (user?.uid ?? null) : null, setPendingCount);
   }, [isInstructor, user?.uid]);

   useEffect(() => {
      const role = userDoc?.role === "instructor" ? "instructor" : userDoc?.role === "learner" ? "learner" : null;
      return subscribeEngagementsForUser(user?.uid ?? null, role, setEngagementRows);
   }, [user?.uid, userDoc?.role]);

   useEffect(() => {
      if (!isInstructor) {
         setInstructorDocSnap(null);
         return () => {};
      }
      return subscribeInstructorDoc(user?.uid ?? null, setInstructorDocSnap);
   }, [isInstructor, user?.uid]);

   useEffect(() => {
      if (!isInstructor) {
         setLatestReviewStars(null);
         return () => {};
      }
      return subscribeLatestReceivedReviewStars(user?.uid ?? null, setLatestReviewStars);
   }, [isInstructor, user?.uid]);

   const nextMeeting = useNextJoinableHomeMeeting(engagementRows);

   const learnerBudget = useMemo(() => {
      if (userDoc?.role !== "learner") return null;
      const src = liveProfileDoc ?? userDoc;
      const cap = src.learningBudgetCapUsd;
      const spent = src.learningBudgetSpentUsd ?? 0;
      const remaining = cap != null && Number.isFinite(cap) ? cap - spent : null;
      return { cap, spent, remaining };
   }, [liveProfileDoc, userDoc]);

   const studentsTutoredCount = useMemo(() => {
      if (!isInstructor) return 0;
      const ids = new Set<string>();
      for (const { data } of engagementRows) ids.add(data.learnerId);
      return ids.size;
   }, [isInstructor, engagementRows]);

   const instructorTotalEarned = useMemo(() => {
      if (!isInstructor || !instructorDocSnap) return 0;
      const rate = instructorDocSnap.hourlyRate ?? 0;
      const now = Date.now();
      let ms = 0;
      for (const { data } of engagementRows) {
         for (const m of data.meetings) {
            const s = timestampToMillis(m.startAt);
            const e = timestampToMillis(m.endAt);
            if (s == null || e == null) continue;
            if (e > now) continue;
            ms += Math.max(0, e - s);
         }
      }
      return (ms / 3_600_000) * rate;
   }, [isInstructor, engagementRows, instructorDocSnap]);

   const instructorLeaderboard = useMemo(() => {
      if (!isInstructor) return [];
      const now = Date.now();
      const byLearner = new Map<string, number>();
      for (const { data } of engagementRows) {
         let n = 0;
         for (const m of data.meetings) {
            const e = timestampToMillis(m.endAt);
            if (e != null && e <= now) n++;
         }
         byLearner.set(data.learnerId, (byLearner.get(data.learnerId) ?? 0) + n);
      }
      return [...byLearner.entries()]
         .map(([learnerId, completedSessions]) => ({ learnerId, completedSessions }))
         .filter((row) => row.completedSessions > 0)
         .sort((a, b) => b.completedSessions - a.completedSessions);
   }, [isInstructor, engagementRows]);

   useEffect(() => {
      if (!isInstructor || instructorLeaderboard.length === 0) {
         setLeaderboardNames({});
         return;
      }
      let cancelled = false;
      void (async () => {
         const pairs = await Promise.all(
            instructorLeaderboard.map(async ({ learnerId }) => {
               const u = await getUserDoc(learnerId);
               const label = u?.fullName?.trim() || u?.email?.split("@")[0]?.trim() || "Student";
               return [learnerId, label] as const;
            }),
         );
         if (!cancelled) setLeaderboardNames(Object.fromEntries(pairs));
      })();
      return () => {
         cancelled = true;
      };
   }, [isInstructor, instructorLeaderboard]);

   async function onLogout() {
      await signOutUser();
      void nav({ to: "/", replace: true });
   }

   return (
      <AppShell>
         <header className="pt-8">
            <div className="flex items-center justify-between">
               <div>
                  <p className={`text-xs font-black uppercase tracking-[0.22em] ${brandTheme.teal}`}>TuneAcademy</p>
                  <h1 className="mt-2 text-5xl font-black tracking-normal text-[#fffdf5]">Today's studio</h1>
               </div>
               <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                     <button
                        type="button"
                        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd666]/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1510]"
                        aria-label="Account menu"
                     >
                        <Avatar initials={initials} size={46} />
                     </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                     <DropdownMenu.Content
                        className="z-50 min-w-[11rem] rounded-lg border border-[#fffdf5]/15 bg-[#0b1510] p-1 shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
                        sideOffset={10}
                        align="end"
                     >
                        <DropdownMenu.Item
                           className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-red-200 outline-none data-[highlighted]:bg-red-500/15 data-[disabled]:opacity-40"
                           onSelect={() => void onLogout()}
                        >
                           <LogOut className="h-4 w-4 shrink-0 text-red-300" />
                           Log out
                        </DropdownMenu.Item>
                     </DropdownMenu.Content>
                  </DropdownMenu.Portal>
               </DropdownMenu.Root>
            </div>
         </header>

         <main className="grid gap-5 pt-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
            <div className="space-y-5">
               {isInstructor ? (
                  <>
                     <motion.section
                        className="grid gap-4 md:grid-cols-3"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                     >
                        <div className="flex min-h-40 flex-col rounded-lg border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-5">
                           <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e8f4df]/55">Students tutored</p>
                              <Users className="h-5 w-5 shrink-0 text-[#a6eee3]/90" />
                           </div>
                           <p className="mt-auto text-5xl font-black leading-none text-[#fffdf5] tabular-nums">{studentsTutoredCount}</p>
                           <p className="mt-2 text-sm font-semibold text-[#ffd666]/90">Unique learners</p>
                        </div>
                        <div className="flex min-h-40 flex-col rounded-lg border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-5">
                           <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e8f4df]/55">Latest rating</p>
                              <Star className="h-5 w-5 shrink-0 text-[#ffd666]/90" />
                           </div>
                           {latestReviewStars != null ? (
                              <InstructorStarRow stars={latestReviewStars} />
                           ) : (
                              <p className="mt-auto text-lg font-bold leading-snug text-[#e8f4df]/50">No ratings yet</p>
                           )}
                        </div>
                        <div className="flex min-h-40 flex-col rounded-lg border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-5">
                           <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e8f4df]/55">Total earned</p>
                              <DollarSign className="h-5 w-5 shrink-0 text-[#2fc5b5]/90" />
                           </div>
                           <p className="mt-auto text-4xl font-black leading-none text-[#fffdf5] tabular-nums">
                              {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
                                 instructorTotalEarned,
                              )}
                           </p>
                           <p className="mt-2 text-sm font-semibold text-[#ffd666]/90">From completed sessions</p>
                        </div>
                     </motion.section>

                     <section className="rounded-lg border border-[#fffdf5]/20 bg-[#0b1510]/55 p-6">
                        <div className="flex items-center justify-between gap-3">
                           <div>
                              <p className={`text-xs font-black uppercase tracking-[0.18em] ${brandTheme.gold}`}>Student leaderboard</p>
                              <h2 className="mt-2 text-2xl font-black">Most sessions together</h2>
                              <p className="mt-1 text-sm font-semibold text-[#e8f4df]/55">
                                 Ranked by completed meetings across your engagements.
                              </p>
                           </div>
                           <Trophy className="h-6 w-6 shrink-0 text-[#ffd666]" />
                        </div>
                        {instructorLeaderboard.length === 0 ? (
                           <p className="mt-6 rounded-lg border border-[#fffdf5]/10 bg-[#fffdf5]/5 px-4 py-6 text-center text-sm font-semibold text-[#e8f4df]/60">
                              When you finish sessions with learners, they will appear here.
                           </p>
                        ) : (
                           <ul className="mt-5 space-y-2">
                              {instructorLeaderboard.map((row, idx) => {
                                 const rank = idx + 1;
                                 const name = leaderboardNames[row.learnerId] ?? "…";
                                 const medal =
                                    rank === 1
                                       ? "text-[#ffd666]"
                                       : rank === 2
                                         ? "text-[#e8f4df]/75"
                                         : rank === 3
                                           ? "text-[#cd7f32]"
                                           : "text-[#e8f4df]/40";
                                 return (
                                    <li key={row.learnerId}>
                                       <Link
                                          to="/app/learner/$userId"
                                          params={{ userId: row.learnerId }}
                                          className="flex items-center justify-between gap-3 rounded-lg border border-[#fffdf5]/12 bg-[#fffdf5]/7 px-4 py-3 transition hover:bg-[#fffdf5]/11"
                                       >
                                          <div className="flex min-w-0 items-center gap-3">
                                             <span
                                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#11140c]/55 text-sm font-black tabular-nums ${medal}`}
                                             >
                                                {rank}
                                             </span>
                                             <span className="truncate font-bold text-[#fffdf5]">{name}</span>
                                          </div>
                                          <span className="shrink-0 text-sm font-semibold tabular-nums text-[#e8f4df]/70">
                                             {row.completedSessions} {row.completedSessions === 1 ? "session" : "sessions"}
                                          </span>
                                       </Link>
                                    </li>
                                 );
                              })}
                           </ul>
                        )}
                     </section>
                  </>
               ) : (
                  <>
                     <motion.section
                        className="overflow-hidden rounded-lg border border-[#fffdf5]/20 bg-[#fffdf5]/12 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl"
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                     >
                        <div className="relative min-h-85 p-8 lg:p-10">
                           <div
                              className="pointer-events-none absolute rounded-full"
                              style={{
                                 width: learnerHeroGlow.size,
                                 height: learnerHeroGlow.size,
                                 right: learnerHeroGlow.right,
                                 top: learnerHeroGlow.top,
                                 filter: `blur(${learnerHeroGlow.blur})`,
                                 background: `radial-gradient(circle, rgba(255,214,102,${learnerHeroGlow.centerOpacity}) 0%, rgba(255,214,102,${learnerHeroGlow.edgeOpacity}) ${learnerHeroGlow.edgeStart}, transparent ${learnerHeroGlow.fadeOut})`,
                              }}
                           />
                           <div className="relative max-w-2xl">
                              <div className="inline-flex items-center gap-2 rounded-lg bg-[linear-gradient(90deg,#ffd666,rgba(255,214,102,0.58))] px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#11140c]">
                                 <Flame className="h-4 w-4" />
                                 AI performance review
                              </div>
                              <h2 className="mt-6 max-w-3xl text-5xl font-black leading-[0.95] tracking-normal">
                                 Find your strengths.
                                 <br />
                                 Fix your weak spots.
                              </h2>
                              <p className="mt-5 max-w-xl text-lg leading-8 text-[#e8f4df]/80">
                                 Record a short take. TuneAcademy finds your strengths, weak spots, next practice steps, and the tutor type
                                 that fits.
                              </p>
                              <Link to="/app/analyze">
                                 <Pill className={`mt-7 px-8 ${brandTheme.primaryButton}`} size="lg">
                                    Record a take
                                    <Mic className="h-4 w-4" />
                                 </Pill>
                              </Link>
                           </div>
                        </div>
                     </motion.section>

                     <section className="grid gap-4 md:grid-cols-3">
                        {placeholderStats.map((stat) => (
                           <div key={stat.label} className="min-h-36 rounded-lg border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-5">
                              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e8f4df]/55">{stat.label}</p>
                              <p className="mt-8 text-5xl font-black leading-none text-[#fffdf5]">{stat.value}</p>
                              {stat.suffix && <p className="mt-2 text-sm font-semibold text-[#ffd666]">{stat.suffix}</p>}
                           </div>
                        ))}
                     </section>

                     <section className="rounded-lg border border-[#fffdf5]/20 bg-[#0b1510]/55 p-6">
                        <div className="flex items-center justify-between">
                           <div>
                              <p className={`text-xs font-black uppercase tracking-[0.18em] ${brandTheme.gold}`}>Practice targets</p>
                              <h2 className="mt-2 text-2xl font-black">Next three fixes</h2>
                           </div>
                           <Sparkles className="h-5 w-5 text-[#ffd666]" />
                        </div>
                        <div className="mt-5 grid gap-3 lg:grid-cols-3">
                           {focusTargets.map((target) => (
                              <div
                                 key={target.label}
                                 className="flex min-h-32 items-start gap-3 rounded-lg border border-[#fffdf5]/12 bg-[#fffdf5]/7 p-4"
                              >
                                 <span className={`h-16 w-1.5 rounded-lg ${target.color}`} />
                                 <div className="min-w-0 flex-1">
                                    <p className="text-base font-bold leading-6 text-[#fffdf5]">{target.label}</p>
                                    <p className="mt-1 text-xs font-semibold text-[#e8f4df]/55">{target.tag}</p>
                                 </div>
                              </div>
                           ))}
                        </div>
                     </section>
                  </>
               )}
            </div>

            <aside className="space-y-5">
               {isInstructor ? (
                  <section
                     className={
                        "rounded-lg border p-6 backdrop-blur transition-all duration-300 " +
                        (pendingCount > 0
                           ? "border-transparent bg-[linear-gradient(135deg,#ffd666,rgba(255,214,102,0.5))] text-[#11140c]"
                           : "border-[#ffd666]/35 bg-[#ffd666]/12 text-[#11140c]")
                     }
                  >
                     <div className="mb-4 flex items-center justify-between">
                        <div>
                           <p className="text-xs font-black uppercase tracking-[0.18em] text-[#11140c]/70">Scheduling</p>
                           <h2 className="mt-2 text-2xl font-black leading-tight text-[#11140c]">Tutoring requests</h2>
                        </div>
                        <Bell className={"h-5 w-5 text-[#11140c]/80 " + (pendingCount > 0 ? "animate-pulse fill-[#11140c]/20" : "")} />
                     </div>
                     {pendingCount > 0 ? (
                        <div className="space-y-3 text-[#11140c]">
                           <p className="text-sm font-semibold leading-relaxed">
                              You have <span className="font-black tabular-nums">{pendingCount}</span> pending request
                              {pendingCount === 1 ? "" : "s"}.
                           </p>
                           <Link
                              to="/app/students"
                              search={{ tab: "pending" }}
                              className="flex items-center justify-between rounded-lg border border-[#11140c]/20 bg-[#11140c]/10 px-4 py-3 text-sm font-black text-[#11140c] transition hover:bg-[#11140c]/16"
                           >
                              Click to handle them
                              <ArrowRight className="h-4 w-4" />
                           </Link>
                        </div>
                     ) : (
                        <div className="space-y-3 text-[#11140c]">
                           <p className="text-sm font-semibold">No pending requests.</p>
                           <Link
                              to="/app/students"
                              search={{ tab: "explore" }}
                              className="flex items-center justify-between rounded-lg border border-[#11140c]/20 bg-[#11140c]/10 px-4 py-3 text-sm font-black text-[#11140c] transition hover:bg-[#11140c]/16"
                           >
                              Search for students
                              <ArrowRight className="h-4 w-4" />
                           </Link>
                        </div>
                     )}
                  </section>
               ) : (
                  <>
                     {learnerBudget ? (
                        <section className="rounded-lg border border-[#2fc5b5]/40 bg-[#0b1510]/80 p-5 backdrop-blur">
                           <div className="flex items-start justify-between gap-3">
                              <div>
                                 <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a6eee3]">Budget</p>
                                 <h2 className="mt-2 text-xl font-black leading-tight text-[#fffdf5]">
                                    {learnerBudget.cap != null ? (
                                       <>
                                          {new Intl.NumberFormat(undefined, {
                                             style: "currency",
                                             currency: "USD",
                                             maximumFractionDigits: 0,
                                          }).format(learnerBudget.cap)}{" "}
                                          <span className="text-sm font-semibold text-[#e8f4df]/60">cap</span>
                                       </>
                                    ) : (
                                       "Set your budget"
                                    )}
                                 </h2>
                                 <p className="mt-1 text-sm font-semibold text-[#e8f4df]/70">
                                    {learnerBudget.cap != null && learnerBudget.remaining != null ? (
                                       <>
                                          Remaining{" "}
                                          <span className={learnerBudget.remaining < 0 ? "text-[#ff6b6b]" : "text-[#2fc5b5]"}>
                                             {new Intl.NumberFormat(undefined, {
                                                style: "currency",
                                                currency: "USD",
                                                maximumFractionDigits: 0,
                                             }).format(learnerBudget.remaining)}
                                          </span>{" "}
                                          after{" "}
                                          {new Intl.NumberFormat(undefined, {
                                             style: "currency",
                                             currency: "USD",
                                             maximumFractionDigits: 0,
                                          }).format(learnerBudget.spent)}{" "}
                                          spent
                                       </>
                                    ) : (
                                       "Set a cap on Profile — completed sessions deduct hours × tutor rate."
                                    )}
                                 </p>
                              </div>
                              <DollarSign className="h-6 w-6 shrink-0 text-[#2fc5b5]" />
                           </div>
                           <Link
                              to="/app/profile"
                              className="mt-4 flex items-center justify-between rounded-lg border border-[#fffdf5]/12 bg-[#fffdf5]/6 px-3 py-2.5 text-sm font-black text-[#fffdf5] transition hover:bg-[#fffdf5]/10"
                           >
                              Edit budget on Profile
                              <ArrowRight className="h-4 w-4" />
                           </Link>
                        </section>
                     ) : null}
                     <section className="rounded-lg border border-[#fffdf5]/20 bg-[#fffdf5]/10 p-6 backdrop-blur">
                        <div className="mb-5 flex items-center justify-between">
                           <div>
                              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a6eee3]">Progress</p>
                              <h2 className="mt-2 text-2xl font-black">Current skill mix</h2>
                           </div>
                           <TrendingUp className="h-5 w-5 text-[#a6eee3]" />
                        </div>
                        <div className="space-y-6">
                           {progressBars.map((bar) => (
                              <div key={bar.label}>
                                 <div className="mb-2 flex justify-between text-sm font-semibold">
                                    <span>{bar.label}</span>
                                    <span className="text-[#e8f4df]/65">{bar.value}%</span>
                                 </div>
                                 <div className="h-2 rounded-lg bg-[#fffdf5]/14">
                                    <motion.div
                                       className={`h-full rounded-lg ${bar.color}`}
                                       initial={{ width: 0 }}
                                       animate={{ width: `${bar.value}%` }}
                                       transition={{ duration: 0.9, delay: 0.15 }}
                                    />
                                 </div>
                              </div>
                           ))}
                        </div>
                     </section>
                  </>
               )}

               <section className="grid gap-3">
                  <div className="rounded-lg border border-transparent bg-[linear-gradient(135deg,#ffd666,rgba(255,214,102,0.5))] p-5 text-[#11140c]">
                     <div className="flex items-start justify-between gap-4">
                        <div>
                           <p className="text-xs font-black uppercase tracking-[0.18em]">Upcoming</p>
                           <h2 className="mt-3 text-xl font-black leading-tight">{nextMeeting ? "Next meeting" : "No session booked"}</h2>
                           <p className="mt-1 text-sm font-semibold opacity-75">
                              {nextMeeting
                                 ? nextMeeting.startAt.toLocaleString(undefined, {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                      hour: "numeric",
                                      minute: "2-digit",
                                   })
                                 : isInstructor
                                   ? "When you accept a request, it shows up here."
                                   : "Request services from an instructor to get started."}
                           </p>
                        </div>
                        <CalendarDays className="h-6 w-6 shrink-0" />
                     </div>
                     {nextMeeting ? (
                        <Link
                           to="/app/meeting"
                           search={{ engagementId: nextMeeting.engagementId, sessionIndex: nextMeeting.sessionIndex }}
                           className="mt-5 block w-full rounded-lg bg-[#11140c]/10 px-3 py-3 text-center text-sm font-black transition hover:bg-[#11140c]/16"
                        >
                           Join meeting
                        </Link>
                     ) : (
                        <p className="mt-5 rounded-lg bg-[#11140c]/10 px-3 py-2 text-center text-xs font-semibold opacity-80">
                           Your next live window will appear here.
                        </p>
                     )}
                  </div>

                  {userDoc?.role === "instructor" ? (
                     <Link
                        to="/app/students"
                        search={{ tab: "explore" }}
                        className="flex items-center justify-between rounded-lg border border-[#ffd666]/35 bg-[#ffd666]/12 p-4 text-sm font-bold text-[#ffd666] transition hover:bg-[#ffd666]/18"
                     >
                        Open student roster
                        <ArrowRight className="h-4 w-4" />
                     </Link>
                  ) : (
                     <Link
                        to="/app/instructors"
                        className="flex items-center justify-between rounded-lg border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-4 text-sm font-bold text-[#fffdf5] transition hover:bg-[#fffdf5]/14"
                     >
                        Browse instructor matches
                        <ArrowRight className="h-4 w-4" />
                     </Link>
                  )}
               </section>
            </aside>
         </main>
      </AppShell>
   );
}
