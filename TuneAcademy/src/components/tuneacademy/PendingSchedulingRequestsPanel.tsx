import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CalendarClock, Check, Loader2, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Avatar } from "@/components/tuneacademy/Avatar";
import { Pill } from "@/components/tuneacademy/Pill";
import { useAuth } from "@/contexts/AuthContext";
import { getFirestoreDb } from "@/lib/firebase";
import { createGoogleMeetLinksForEngagement } from "@/lib/googleCalendar";
import { getUserDoc } from "@/lib/tuneacademyFirestore";
import { formatSlotLabel } from "@/lib/scheduling";
import {
   acceptTutoringRequest,
   declineTutoringRequest,
   subscribePendingRequestsForInstructor,
   type TutoringRequestDoc,
} from "@/lib/tutoringFirestore";
import { brandTheme } from "@/lib/theme";
import { toast } from "sonner";

type LearnerSnippet = { fullName: string; bio: string; avatarUrl: string; instruments: string[] };

function useLearnerSnippet(learnerId: string | undefined): LearnerSnippet | null | "loading" {
   const [s, setS] = useState<LearnerSnippet | null | "loading">("loading");

   useEffect(() => {
      if (!learnerId) {
         setS(null);
         return;
      }
      let cancelled = false;
      void (async () => {
         setS("loading");
         try {
            const u = await getUserDoc(learnerId);
            const db = getFirestoreDb();
            const rq = query(collection(db, "reels"), where("uploaderId", "==", learnerId));
            const rs = await getDocs(rq);
            const instruments = new Set<string>();
            rs.forEach((d) => {
               const inst = d.data().instrument as string | undefined;
               if (inst?.trim()) instruments.add(inst.trim().toLowerCase());
            });
            if (cancelled) return;
            setS({
               fullName: u?.fullName?.trim() || "Learner",
               bio: (u?.bio ?? "").trim(),
               avatarUrl: (u?.avatarUrl ?? "").trim(),
               instruments: [...instruments].sort(),
            });
         } catch {
            if (!cancelled) setS(null);
         }
      })();
      return () => {
         cancelled = true;
      };
   }, [learnerId]);

   return s;
}

function RequestCard({ id, data, instructorId }: { id: string; data: TutoringRequestDoc; instructorId: string }) {
   const snippet = useLearnerSnippet(data.learnerId);
   const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

   const initials =
      snippet && snippet !== "loading"
         ? snippet.fullName
              .split(/\s+/)
              .filter(Boolean)
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase() || "?"
         : "?";

   async function onAccept() {
      setBusy("accept");
      try {
         const engagementId = await acceptTutoringRequest(id, instructorId);
         try {
            const result = await createGoogleMeetLinksForEngagement(engagementId);
            toast.success(
               result.created > 0
                  ? `You're now tutoring this student. ${result.created} Google Meet link${result.created === 1 ? "" : "s"} created.`
                  : "You're now tutoring this student. Google Calendar events were already ready.",
            );
         } catch {
            toast.success("You're now tutoring this student.");
            toast.message("Demo Meet links are active until Google Calendar is connected.");
         }
      } catch (e) {
         toast.error(e instanceof Error ? e.message : "Could not accept.");
      } finally {
         setBusy(null);
      }
   }

   async function onDecline() {
      setBusy("decline");
      try {
         await declineTutoringRequest(id, instructorId);
         toast.success("Request declined.");
      } catch (e) {
         toast.error(e instanceof Error ? e.message : "Could not decline.");
      } finally {
         setBusy(null);
      }
   }

   return (
      <motion.article
         layout
         initial={{ opacity: 0, y: 12 }}
         animate={{ opacity: 1, y: 0 }}
         className="overflow-hidden rounded-2xl border border-[#fffdf5]/12 bg-gradient-to-br from-[#fffdf5]/8 to-[#0b1510]/85 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)]"
      >
         <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex shrink-0 items-center gap-3">
               {snippet !== "loading" && snippet?.avatarUrl ? (
                  <img src={snippet.avatarUrl} alt="" className="h-16 w-16 rounded-2xl border border-[#fffdf5]/20 object-cover" />
               ) : (
                  <Avatar initials={initials} size={64} className="rounded-2xl text-lg" />
               )}
               <div className="min-w-0 sm:hidden">
                  <p className="truncate text-base font-black text-[#fffdf5]">
                     {snippet === "loading" ? "Loading…" : (snippet?.fullName ?? "Learner")}
                  </p>
               </div>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
               <div className="hidden sm:block">
                  <p className="truncate text-lg font-black text-[#fffdf5]">
                     {snippet === "loading" ? "Loading…" : (snippet?.fullName ?? "Learner")}
                  </p>
                  <p className="mt-0.5 text-xs text-[#e8f4df]/50">Requested tutoring services</p>
               </div>
               <p className="text-xs text-[#e8f4df]/50 sm:hidden">Requested tutoring services</p>

               {snippet !== "loading" && snippet?.instruments.length ? (
                  <div className="flex flex-wrap gap-1">
                     {snippet.instruments.map((ins) => (
                        <span
                           key={ins}
                           className="rounded-full border border-[#2fc5b5]/35 bg-[#2fc5b5]/12 px-2.5 py-0.5 text-[10px] font-bold capitalize text-[#a6eee3]"
                        >
                           {ins}
                        </span>
                     ))}
                  </div>
               ) : null}

               {snippet !== "loading" && snippet?.bio ? (
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-widest text-[#e8f4df]/40">Bio</p>
                     <p className="mt-1 text-sm leading-relaxed text-[#e8f4df]/75">{snippet.bio}</p>
                  </div>
               ) : snippet !== "loading" ? (
                  <p className="text-sm text-[#e8f4df]/45">No bio on file.</p>
               ) : null}

               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#e8f4df]/40">
                     Weekly times ({data.weeks} wk{data.weeks === 1 ? "" : "s"})
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                     {data.weeklySlots.map((s, idx) => (
                        <li
                           key={`${s.weekday}-${s.startMinute}-${idx}`}
                           className="rounded-lg border border-[#fffdf5]/12 bg-[#0b1510]/50 px-2 py-1 text-[11px] font-semibold text-[#fffdf5]/90"
                        >
                           {formatSlotLabel(s)}
                        </li>
                     ))}
                  </ul>
               </div>

               {data.message.trim() ? (
                  <div className="rounded-xl border border-[#ffd666]/25 bg-[#ffd666]/8 p-3">
                     <p className="text-[10px] font-black uppercase tracking-widest text-[#ffd666]/90">Message from student</p>
                     <p className="mt-1 text-sm leading-relaxed text-[#fffdf5]/90">{data.message.trim()}</p>
                  </div>
               ) : null}

               <div className="flex flex-wrap gap-2 pt-1">
                  <button
                     type="button"
                     className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#2fc5b5] px-4 py-2.5 text-sm font-bold text-[#0b1510] transition hover:bg-[#45d9c4] disabled:opacity-40 sm:flex-none"
                     disabled={busy !== null}
                     onClick={() => void onAccept()}
                  >
                     {busy === "accept" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                     ) : (
                        <>
                           <Check className="h-4 w-4" /> Accept
                        </>
                     )}
                  </button>
                  <button
                     type="button"
                     className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#fffdf5]/25 bg-transparent px-4 py-2.5 text-sm font-bold text-[#fffdf5] transition hover:bg-[#fffdf5]/10 disabled:opacity-40 sm:flex-none"
                     disabled={busy !== null}
                     onClick={() => void onDecline()}
                  >
                     {busy === "decline" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                     ) : (
                        <>
                           <X className="h-4 w-4" /> Decline
                        </>
                     )}
                  </button>
                  <Link
                     to="/app/learner/$userId"
                     params={{ userId: data.learnerId }}
                     search={{
                        displayName: snippet !== "loading" ? snippet?.fullName : undefined,
                        avatarUrl: snippet !== "loading" ? snippet?.avatarUrl : undefined,
                     }}
                     className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-[#a6eee3] ring-1 ring-[#a6eee3]/35 transition hover:bg-[#a6eee3]/10 sm:flex-none"
                  >
                     <User className="h-4 w-4" />
                     Full profile
                  </Link>
               </div>
            </div>
         </div>
      </motion.article>
   );
}

export function PendingSchedulingRequestsPanel() {
   const { user } = useAuth();
   const [rows, setRows] = useState<{ id: string; data: TutoringRequestDoc }[]>([]);

   useEffect(() => {
      return subscribePendingRequestsForInstructor(user?.uid ?? null, (r) => {
         setRows(r);
      });
   }, [user?.uid]);

   if (!rows.length) {
      return (
         <div className="mt-10 rounded-2xl border border-[#fffdf5]/12 bg-[#fffdf5]/5 p-12 text-center">
            <CalendarClock className="mx-auto h-10 w-10 text-[#ffd666]/80" />
            <p className="mt-4 text-lg font-black text-[#fffdf5]">No pending requests</p>
            <p className="mt-2 text-sm text-[#e8f4df]/55">When a student sends a schedule, it will land here for you to review.</p>
            <Link to="/app/students" search={{ tab: "explore" }}>
               <Pill className={`mt-6 ${brandTheme.primaryButton}`} size="sm">
                  Browse students
               </Pill>
            </Link>
         </div>
      );
   }

   return (
      <div className="mt-2 space-y-4">
         <p className="text-sm leading-relaxed text-[#e8f4df]/60">
            {rows.length} pending request{rows.length === 1 ? "" : "s"}. Accepting reserves those weekly blocks on your calendar so other
            learners cannot pick the same times.
         </p>
         <ul className="space-y-4">
            {rows.map((row) => (
               <li key={row.id}>
                  <RequestCard id={row.id} data={row.data} instructorId={user!.uid} />
               </li>
            ))}
         </ul>
      </div>
   );
}
