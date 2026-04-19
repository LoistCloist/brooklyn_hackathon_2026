import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
   AlertDialog,
   AlertDialogCancel,
   AlertDialogContent,
   AlertDialogDescription,
   AlertDialogFooter,
   AlertDialogHeader,
   AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileUpcomingMeetings, type ProfileUpcomingSlot } from "@/hooks/useProfileUpcomingMeetings";
import { createGoogleMeetLinksForEngagement } from "@/lib/googleCalendar";
import { brandTheme } from "@/lib/theme";
import { cancelMeetingSession } from "@/lib/tutoringFirestore";
import { getUserDoc } from "@/lib/tuneacademyFirestore";
import { ArrowRight, CalendarDays, RefreshCw, Video, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function ProfileUpcomingMeetings() {
   const { user, userDoc } = useAuth();
   const role = userDoc?.role === "learner" ? "learner" : userDoc?.role === "instructor" ? "instructor" : null;

   const { slots, sessionByKey } = useProfileUpcomingMeetings(user?.uid ?? null, role);
   const [names, setNames] = useState<Record<string, string>>({});
   const [cancelTarget, setCancelTarget] = useState<ProfileUpcomingSlot | null>(null);
   const [cancellingId, setCancellingId] = useState<string | null>(null);
   const [syncingCalendar, setSyncingCalendar] = useState(false);

   useEffect(() => {
      const ids = new Set<string>();
      for (const s of slots) {
         ids.add(s.learnerId);
         ids.add(s.instructorId);
      }
      if (ids.size === 0) {
         setNames({});
         return;
      }
      let cancelled = false;
      void Promise.all(
         [...ids].map(async (id) => {
            const u = await getUserDoc(id);
            const label = u?.fullName?.trim() || u?.email?.split("@")[0]?.trim() || "User";
            return [id, label] as const;
         }),
      ).then((pairs) => {
         if (!cancelled) setNames(Object.fromEntries(pairs));
      });
      return () => {
         cancelled = true;
      };
   }, [slots]);

   if (!user || !role) return null;

   function otherPartyLabel(slot: ProfileUpcomingSlot): string {
      const oid = role === "learner" ? slot.instructorId : slot.learnerId;
      return names[oid] ?? "…";
   }

   async function confirmCancel() {
      if (!user || !cancelTarget) return;
      setCancellingId(cancelTarget.key);
      try {
         await cancelMeetingSession({ uid: user.uid, engagementId: cancelTarget.engagementId, sessionIndex: cancelTarget.sessionIndex });
         toast.success("Meeting cancelled — you and your partner will no longer see this session.");
         setCancelTarget(null);
      } catch (e) {
         toast.error(e instanceof Error ? e.message : "Could not cancel.");
      } finally {
         setCancellingId(null);
      }
   }

   async function syncGoogleCalendar() {
      if (!user || role !== "instructor") return;
      const engagementIds = [
         ...new Set(slots.filter((slot) => !sessionByKey[slot.key]?.googleCalendarEventId).map((slot) => slot.engagementId)),
      ];
      if (!engagementIds.length) {
         toast.message("All visible sessions already have Google Calendar events.");
         return;
      }
      setSyncingCalendar(true);
      try {
         const results = await Promise.all(engagementIds.map((engagementId) => createGoogleMeetLinksForEngagement(engagementId)));
         const created = results.reduce((sum, result) => sum + result.created, 0);
         const skipped = results.reduce((sum, result) => sum + result.skipped, 0);
         toast.success(
            created > 0
               ? `${created} missing Google Calendar event${created === 1 ? "" : "s"} created.`
               : "Google Calendar is already synced.",
         );
         if (skipped > 0) toast.message(`${skipped} session${skipped === 1 ? "" : "s"} already had events or could not be synced.`);
      } catch (error) {
         toast.error(error instanceof Error ? error.message : "Could not sync Google Calendar.");
      } finally {
         setSyncingCalendar(false);
      }
   }

   return (
      <>
         <motion.section
            className="rounded-xl border border-[#fffdf5]/18 bg-[#0b1510]/70 p-6"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
         >
            <div className="flex flex-wrap items-start justify-between gap-3">
               <div>
                  <p className={`text-xs font-black uppercase tracking-[0.18em] ${brandTheme.teal}`}>Upcoming meetings</p>
                  <h2 className="mt-2 text-xl font-black text-[#fffdf5]">Your schedule</h2>
                  <p className="mt-1 text-sm font-semibold text-[#e8f4df]/60">
                     Cancel a session anytime before it ends — it disappears for both you and your{" "}
                     {role === "learner" ? "instructor" : "student"}.
                  </p>
               </div>
               <div className="flex shrink-0 items-center gap-2">
                  {role === "instructor" && slots.length > 0 ? (
                     <Button
                        type="button"
                        size="sm"
                        className="border-[#ffd666]/35 bg-[#ffd666]/12 text-[#ffd666] hover:bg-[#ffd666]/20"
                        disabled={syncingCalendar}
                        onClick={() => void syncGoogleCalendar()}
                     >
                        <RefreshCw className={`mr-1.5 h-4 w-4 ${syncingCalendar ? "animate-spin" : ""}`} />
                        {syncingCalendar ? "Syncing..." : "Sync Google Calendar"}
                     </Button>
                  ) : null}
                  <CalendarDays className="h-8 w-8 text-[#ffd666]/90" aria-hidden />
               </div>
            </div>

            {slots.length === 0 ? (
               <p className="mt-6 rounded-lg border border-[#fffdf5]/10 bg-[#fffdf5]/5 px-4 py-5 text-center text-sm font-semibold text-[#e8f4df]/55">
                  No upcoming sessions. Active tutoring bookings will show up here for you and your{" "}
                  {role === "learner" ? "instructor" : "student"}.
               </p>
            ) : (
               <ul className="mt-5 space-y-3">
                  {slots.map((slot) => {
                     const busy = cancellingId === slot.key;
                     return (
                        <li
                           key={slot.key}
                           className="flex flex-col gap-3 rounded-lg border border-[#fffdf5]/12 bg-[#fffdf5]/6 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                           <div className="min-w-0">
                              <p className="text-sm font-black text-[#fffdf5]">
                                 {slot.startAt.toLocaleString(undefined, {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                 })}{" "}
                                 <span className="font-semibold text-[#e8f4df]/55">→</span>{" "}
                                 {slot.endAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                              </p>
                              <p className="mt-1 text-sm font-semibold text-[#e8f4df]/70">
                                 {role === "learner" ? "Instructor" : "Student"}:{" "}
                                 <span className="text-[#fffdf5]/90">{otherPartyLabel(slot)}</span>
                              </p>
                           </div>
                           <div className="flex shrink-0 flex-wrap gap-2">
                              <Link
                                 to="/app/meeting"
                                 search={{ engagementId: slot.engagementId, sessionIndex: slot.sessionIndex }}
                                 className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#ffd666]/40 bg-[#ffd666]/15 px-3 text-sm font-black text-[#ffd666] transition hover:bg-[#ffd666]/25"
                              >
                                 <Video className="h-4 w-4" />
                                 Meet
                                 <ArrowRight className="h-3.5 w-3.5 opacity-80" />
                              </Link>
                              <Button
                                 type="button"
                                 variant="outline"
                                 size="sm"
                                 disabled={busy}
                                 className="border-[#ff6b6b]/45 text-[#ff6b6b] hover:bg-[#ff6b6b]/10"
                                 onClick={() => setCancelTarget(slot)}
                              >
                                 <XCircle className="mr-1.5 h-4 w-4" />
                                 {busy ? "Cancelling…" : "Cancel"}
                              </Button>
                           </div>
                        </li>
                     );
                  })}
               </ul>
            )}
         </motion.section>

         <AlertDialog
            open={cancelTarget != null}
            onOpenChange={(open) => {
               if (!open) setCancelTarget(null);
            }}
         >
            <AlertDialogContent className="border-[#fffdf5]/15 bg-[#0b1510] text-[#fffdf5]">
               <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this meeting?</AlertDialogTitle>
                  <AlertDialogDescription className="text-[#e8f4df]/65">
                     This removes the session for you and {cancelTarget ? otherPartyLabel(cancelTarget) : "the other person"}. You can still
                     message them to reschedule.
                  </AlertDialogDescription>
               </AlertDialogHeader>
               <AlertDialogFooter>
                  <AlertDialogCancel className="border-[#fffdf5]/20 bg-transparent text-[#fffdf5] hover:bg-[#fffdf5]/10">
                     Keep session
                  </AlertDialogCancel>
                  <Button type="button" variant="destructive" disabled={cancellingId != null} onClick={() => void confirmCancel()}>
                     {cancellingId ? "Cancelling…" : "Yes, cancel"}
                  </Button>
               </AlertDialogFooter>
            </AlertDialogContent>
         </AlertDialog>
      </>
   );
}
