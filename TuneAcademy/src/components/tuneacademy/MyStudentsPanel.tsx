import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowUpRight, MessageSquare, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { InstructorLearnerMessageDialog } from "@/components/tuneacademy/InstructorLearnerMessageDialog";
import { Pill } from "@/components/tuneacademy/Pill";
import { useAuth } from "@/contexts/AuthContext";
import { isEngagementActive } from "@/lib/scheduling";
import { getUserDoc } from "@/lib/tuneacademyFirestore";
import { subscribeEngagementsForInstructor, type TutoringEngagementDoc } from "@/lib/tutoringFirestore";
import { brandTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type LearnerRow = { learnerId: string; fullName: string; avatarUrl: string };

export function MyStudentsPanel() {
   const { user, userDoc } = useAuth();
   const [engagements, setEngagements] = useState<{ id: string; data: TutoringEngagementDoc }[]>([]);
   const [learners, setLearners] = useState<LearnerRow[]>([]);
   const [loadingDocs, setLoadingDocs] = useState(false);
   const [messageOpen, setMessageOpen] = useState(false);
   const [messageTarget, setMessageTarget] = useState<{ id: string; name: string } | null>(null);

   useEffect(() => {
      return subscribeEngagementsForInstructor(user?.uid ?? null, setEngagements);
   }, [user?.uid]);

   const activeLearnerIds = useMemo(() => {
      const now = Date.now();
      const ids = new Set<string>();
      for (const { data } of engagements) {
         if (isEngagementActive(data.meetings, now)) ids.add(data.learnerId);
      }
      return [...ids].sort();
   }, [engagements]);

   const activeLearnerIdKey = activeLearnerIds.join("\u0001");

   useEffect(() => {
      const ids = activeLearnerIdKey ? activeLearnerIdKey.split("\u0001") : [];
      if (!ids.length) {
         setLearners([]);
         setLoadingDocs(false);
         return;
      }
      let cancelled = false;
      setLoadingDocs(true);
      void Promise.all(
         ids.map(async (learnerId) => {
            const u = await getUserDoc(learnerId);
            return { learnerId, fullName: u?.fullName?.trim() || "Learner", avatarUrl: u?.avatarUrl?.trim() || "" } satisfies LearnerRow;
         }),
      )
         .then((rows) => {
            if (!cancelled) {
               rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
               setLearners(rows);
            }
         })
         .finally(() => {
            if (!cancelled) setLoadingDocs(false);
         });
      return () => {
         cancelled = true;
      };
   }, [activeLearnerIdKey]);

   const activeSeriesCount = (learnerId: string) => {
      const now = Date.now();
      return engagements.filter((e) => e.data.learnerId === learnerId && isEngagementActive(e.data.meetings, now)).length;
   };

   if (!activeLearnerIds.length && !loadingDocs) {
      return (
         <div className="mt-10 rounded-2xl border border-[#fffdf5]/12 bg-[#fffdf5]/5 p-12 text-center">
            <Users className="mx-auto h-10 w-10 text-[#a6eee3]/80" />
            <p className="mt-4 text-lg font-black text-[#fffdf5]">No students yet</p>
            <p className="mt-2 text-sm text-[#e8f4df]/55">
               When you accept a tutoring request, that learner appears here while the series is still active.
            </p>
            <Link to="/app/students" search={{ tab: "explore" }}>
               <Pill className={`mt-6 ${brandTheme.primaryButton}`} size="sm">
                  Explore students
               </Pill>
            </Link>
         </div>
      );
   }

   return (
      <>
         <p className="mt-2 text-sm text-[#e8f4df]/60">
            Learners you are actively tutoring (accepted schedule with future sessions remaining).
         </p>

         {loadingDocs && learners.length === 0 ? (
            <div className="mt-16 flex flex-col items-center justify-center gap-3 text-[#e8f4df]/55">
               <motion.div
                  className="h-10 w-10 rounded-full border-2 border-[#ffd666]/30 border-t-[#ffd666]"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
               />
               <p className="text-sm font-semibold">Loading your students…</p>
            </div>
         ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
               {learners.map((row) => (
                  <motion.li
                     key={row.learnerId}
                     layout
                     initial={{ opacity: 0, y: 12 }}
                     animate={{ opacity: 1, y: 0 }}
                     className="overflow-hidden rounded-2xl border border-[#fffdf5]/12 bg-gradient-to-br from-[#fffdf5]/9 to-[#0b1510]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)]"
                  >
                     <div className="flex gap-4">
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#fffdf5]/20 bg-[#0b1510] text-lg font-black text-[#fffdf5]">
                           {row.avatarUrl ? (
                              <img src={row.avatarUrl} alt="" className="h-full w-full object-cover" />
                           ) : (
                              <span className="flex h-full w-full items-center justify-center">
                                 {(row.fullName[0] || "?").toUpperCase()}
                              </span>
                           )}
                        </div>
                        <div className="min-w-0 flex-1">
                           <p className="truncate font-black text-[#fffdf5]">{row.fullName}</p>
                           <p className="truncate text-xs text-[#e8f4df]/50">Contact protected in TuneAcademy</p>
                           <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-[#2fc5b5]/90">
                              {activeSeriesCount(row.learnerId)} active series
                           </p>
                        </div>
                     </div>
                     <div className="mt-4 flex gap-2">
                        <Link
                           to="/app/learner/$userId"
                           params={{ userId: row.learnerId }}
                           search={{ displayName: row.fullName, avatarUrl: row.avatarUrl || undefined }}
                           className={cn(
                              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#fffdf5]/18 py-2.5 text-xs font-black uppercase tracking-[0.12em] text-[#fffdf5] transition hover:border-[#fffdf5]/35 hover:bg-[#fffdf5]/8",
                           )}
                        >
                           Profile
                           <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                        <button
                           type="button"
                           disabled={!user}
                           onClick={() => {
                              setMessageTarget({ id: row.learnerId, name: row.fullName });
                              setMessageOpen(true);
                           }}
                           className={cn(
                              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black uppercase tracking-[0.12em] transition",
                              "bg-[#ffd666] text-[#11140c] hover:bg-[#ffe08a] disabled:cursor-not-allowed disabled:opacity-35",
                           )}
                        >
                           <MessageSquare className="h-3.5 w-3.5" />
                           Message
                        </button>
                     </div>
                  </motion.li>
               ))}
            </ul>
         )}

         {messageTarget && user ? (
            <InstructorLearnerMessageDialog
               open={messageOpen}
               onOpenChange={(o) => {
                  setMessageOpen(o);
                  if (!o) setMessageTarget(null);
               }}
               learnerId={messageTarget.id}
               learnerName={messageTarget.name}
               instructorId={user.uid}
               instructorName={userDoc?.fullName?.trim() || user.displayName || "Instructor"}
               onSent={() => {
                  setMessageOpen(false);
                  setMessageTarget(null);
               }}
            />
         ) : null}
      </>
   );
}
