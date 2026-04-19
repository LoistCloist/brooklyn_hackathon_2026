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
import {
   dedupeWeeklySlots,
   flattenEngagementHolds,
   formatSlotLabel,
   slotKey,
   subtractRecurringHolds,
   type WeeklyTimeSlot,
} from "@/lib/scheduling";
import { getInstructorDoc } from "@/lib/tuneacademyFirestore";
import type { InstructorFirestoreDoc } from "@/lib/tuneacademyFirestore";
import {
   createTutoringRequest,
   fetchEngagementsForInstructor,
   TUTORING_MESSAGE_MAX,
   type TutoringEngagementDoc,
} from "@/lib/tutoringFirestore";
import { ArrowLeft, Star, MessageSquare, Calendar, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/app/instructors/$id")({
   head: () => ({ meta: [{ title: "Instructor â€” TuneAcademy" }] }),
   component: InstructorProfile,
});

function initialsFromName(name: string): string {
   const parts = name.trim().split(/\s+/).filter(Boolean);
   if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
   if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
   return (parts[0]?.[0] || "?").toUpperCase();
}

const GROUP_SEAT_CAPACITY = 3;

function groupSeatCountForSlot(engagements: TutoringEngagementDoc[], slot: WeeklyTimeSlot): number {
   const key = slotKey(slot);
   return engagements.reduce((count, engagement) => {
      if ((engagement.sessionType ?? "solo") !== "group") return count;
      return count + (engagement.weeklySlots.some((s) => slotKey(s) === key) ? 1 : 0);
   }, 0);
}

function groupSeatsLeftForSlot(engagements: TutoringEngagementDoc[], slot: WeeklyTimeSlot): number {
   return Math.max(0, GROUP_SEAT_CAPACITY - groupSeatCountForSlot(engagements, slot));
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

   const [engagements, setEngagements] = useState<TutoringEngagementDoc[]>([]);
   useEffect(() => {
      void fetchEngagementsForInstructor(id).then((rows) => {
         setEngagements(rows.map((r) => r.data));
      });
   }, [id]);

   const [open, setOpen] = useState<"request" | "chat" | null>(null);
   const [selectedSlots, setSelectedSlots] = useState<WeeklyTimeSlot[]>([]);
   const [weeks, setWeeks] = useState(1);
   const [requestMessage, setRequestMessage] = useState("");
   const [requestSending, setRequestSending] = useState(false);
   const [sent, setSent] = useState(false);
   const [dmText, setDmText] = useState("");
   const [chosenSessionType, setChosenSessionType] = useState<"solo" | "group">("solo");
   const [dmSending, setDmSending] = useState(false);

   const offeredSlots = useMemo(() => {
      if (!i) return [];
      const baseSlots = chosenSessionType === "group" ? ((i as any).groupWeeklyAvailability ?? []) : (i.weeklyAvailability ?? []);
      const uniqueBaseSlots = dedupeWeeklySlots(baseSlots);
      if (chosenSessionType === "group") {
         return uniqueBaseSlots.filter((slot) => groupSeatsLeftForSlot(engagements, slot) > 0);
      }
      const holds = flattenEngagementHolds(engagements.map((e) => ({ weeklySlots: e.weeklySlots, meetings: e.meetings })));
      return subtractRecurringHolds(uniqueBaseSlots, holds);
   }, [i, engagements, chosenSessionType]);

   const groupSeatSummary = useMemo(() => {
      if (!i) return { openSlots: 0, totalSeatsLeft: 0 };
      const groupSlots = dedupeWeeklySlots((i as any).groupWeeklyAvailability ?? []);
      return groupSlots.reduce(
         (summary, slot) => {
            const seatsLeft = groupSeatsLeftForSlot(engagements, slot);
            if (seatsLeft > 0) {
               summary.openSlots += 1;
               summary.totalSeatsLeft += seatsLeft;
            }
            return summary;
         },
         { openSlots: 0, totalSeatsLeft: 0 },
      );
   }, [i, engagements]);

   const maxWeeksForInstructor = Math.min(52, Math.max(1, i?.maxTutoringWeeks ?? 12));

   useEffect(() => {
      if (!i) return;
      const cap = Math.min(52, Math.max(1, i.maxTutoringWeeks ?? 12));
      setWeeks((w) => Math.min(Math.max(1, w), cap));
   }, [i]);

   const canDm = Boolean(user?.uid) && userDoc?.role === "learner" && user?.uid !== id && Boolean(i?.fullName);

   const canRequestServices = canDm;

   function toggleWeeklySlot(slot: WeeklyTimeSlot) {
      const k = slotKey(slot);
      setSelectedSlots((prev) => {
         const has = prev.some((s) => slotKey(s) === k);
         if (has) return prev.filter((s) => slotKey(s) !== k);
         return [...prev, slot];
      });
   }

   const sendServiceRequest = async () => {
      if (!user?.uid || !i) return;
      if (!selectedSlots.length) {
         toast.error("Pick at least one weekly time.");
         return;
      }
      if (weeks < 1 || weeks > maxWeeksForInstructor) {
         toast.error(`Choose 1â€“${maxWeeksForInstructor} weeks.`);
         return;
      }
      setRequestSending(true);
      try {
         await createTutoringRequest({
            learnerId: user.uid,
            instructorId: id,
            sessionType: chosenSessionType,
            weeklySlots: dedupeWeeklySlots(selectedSlots),
            weeks,
            message: requestMessage,
         });
         toast.success("Request sent");
         setSent(true);
      } catch (e) {
         toast.error(e instanceof Error ? e.message : "Could not send request.");
      } finally {
         setRequestSending(false);
      }
   };

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
            <div className="p-8 text-center text-sm text-muted-foreground">Loadingâ€¦</div>
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
            <Avatar initials={initialsFromName(i.fullName)} src={i.avatarUrl} size={88} className="text-2xl" />
            <h1 className="mt-4 text-2xl font-bold tracking-tight">{i.fullName}</h1>
            <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
               <Star className="h-3.5 w-3.5 fill-foreground text-foreground" />
               <span className="tabular-nums text-foreground">{i.rating.toFixed(1)}</span>
               <span></span>
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
            <p className="mt-2 text-xs font-medium">{i.hourlyRate === 0 ? "Free first lesson" : `$${i.hourlyRate}/hr`}</p>
         </div>

         <div className="grid grid-cols-2 gap-3 px-5 pt-6">
            <Pill
               disabled={!canRequestServices}
               onClick={() => {
                  if (!canRequestServices) {
                     toast.error("Sign in as a learner to request services.");
                     return;
                  }
                  setSelectedSlots([]);
                  setWeeks(1);
                  setRequestMessage("");
                  setSent(false);
                  setOpen("request");
               }}
            >
               <Calendar className="h-4 w-4" /> Request services
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
                     if (requestSending) return;
                     setOpen(null);
                     setSent(false);
                     setSelectedSlots([]);
                     setWeeks(1);
                     setRequestMessage("");
                  }}
               >
                  {sent ? (
                     <div className="py-12 text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-foreground">
                           âœ“
                        </div>
                        <h3 className="text-lg font-semibold">Request sent</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{i.fullName} will review your proposed schedule.</p>
                        <Pill
                           className="mt-6 w-full"
                           onClick={() => {
                              setOpen(null);
                              setSent(false);
                              setSelectedSlots([]);
                              setWeeks(1);
                              setRequestMessage("");
                           }}
                        >
                           Done
                        </Pill>
                     </div>
                  ) : (
                     <>
                        <h3 className="text-lg font-semibold tracking-tight">Request services</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                           Choose your session type, recurring weekly times, and an optional note.
                        </p>

                        {/* Session type picker */}
                        {((i as any).sessionType === "both" || (i as any).sessionType === "solo" || (i as any).sessionType === "group") && (
                           <>
                              <p className="mt-5 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Session type</p>
                              <div className="grid grid-cols-2 gap-2">
                                 {((i as any).sessionType === "solo" || (i as any).sessionType === "both") && (
                                    <button
                                       type="button"
                                       onClick={() => setChosenSessionType("solo")}
                                       className={`rounded-xl border p-3 text-center text-sm font-semibold transition-all ${
                                          chosenSessionType === "solo"
                                             ? "border-foreground bg-foreground text-background"
                                             : "border-hairline bg-surface text-foreground"
                                       }`}
                                    >
                                       1-on-1
                                       {(i as any).hourlyRate === 0 ? (
                                          <span className="mt-0.5 block text-[10px] font-normal opacity-70">Free</span>
                                       ) : (
                                          <span className="mt-0.5 block text-[10px] font-normal opacity-70">
                                             ${(i as any).hourlyRate}/hr
                                          </span>
                                       )}
                                    </button>
                                 )}
                                 {((i as any).sessionType === "group" || (i as any).sessionType === "both") && (
                                    <button
                                       type="button"
                                       onClick={() => setChosenSessionType("group")}
                                       className={`rounded-xl border p-3 text-center text-sm font-semibold transition-all ${
                                          chosenSessionType === "group"
                                             ? "border-foreground bg-foreground text-background"
                                             : "border-hairline bg-surface text-foreground"
                                       }`}
                                    >
                                       <span className="inline-flex items-center justify-center gap-1">
                                          <Users className="h-3.5 w-3.5" />
                                          Group (3:1)
                                       </span>
                                       {(i as any).groupHourlyRate === 0 ? (
                                          <span className="mt-0.5 block text-[10px] font-normal opacity-70">Free</span>
                                       ) : (
                                          <span className="mt-0.5 block text-[10px] font-normal opacity-70">
                                             ${(i as any).groupHourlyRate}/person
                                          </span>
                                       )}
                                    </button>
                                 )}
                              </div>
                              {((i as any).sessionType === "group" || (i as any).sessionType === "both") && (
                                 <div className="mt-3 rounded-xl border border-[#2fc5b5]/25 bg-[#2fc5b5]/10 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                       <div>
                                          <p className="text-xs font-black uppercase tracking-widest text-[#a6eee3]">Group seats</p>
                                          <p className="mt-1 text-xs text-muted-foreground">
                                             {groupSeatSummary.openSlots} open weekly time{groupSeatSummary.openSlots === 1 ? "" : "s"}
                                          </p>
                                       </div>
                                       <div className="flex items-center gap-1.5 rounded-full border border-[#a6eee3]/35 bg-[#a6eee3]/10 px-3 py-1 text-xs font-black text-[#a6eee3]">
                                          <Users className="h-3.5 w-3.5" />
                                          {groupSeatSummary.totalSeatsLeft} seats left
                                       </div>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden>
                                       {[0, 1, 2].map((seat) => (
                                          <span
                                             key={seat}
                                             className={`h-1.5 rounded-full ${
                                                seat < Math.min(GROUP_SEAT_CAPACITY, groupSeatSummary.totalSeatsLeft)
                                                   ? "bg-[#2fc5b5]"
                                                   : "bg-[#fffdf5]/15"
                                             }`}
                                          />
                                       ))}
                                    </div>
                                 </div>
                              )}
                           </>
                        )}

                        <p className="mt-5 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Weekly times</p>
                        {offeredSlots.length === 0 ? (
                           <p className="rounded-xl border border-hairline bg-muted/30 p-4 text-sm text-muted-foreground">
                              This instructor has not published open hours yet, or every slot is currently reserved.
                           </p>
                        ) : (
                           <div className="max-h-48 overflow-y-auto rounded-xl border border-hairline bg-muted/20 p-3">
                              <div className="flex flex-wrap gap-2">
                                 {offeredSlots.map((s) => {
                                    const active = selectedSlots.some((x) => slotKey(x) === slotKey(s));
                                    const seatsLeft = chosenSessionType === "group" ? groupSeatsLeftForSlot(engagements, s) : null;
                                    return (
                                       <button
                                          key={slotKey(s)}
                                          type="button"
                                          onClick={() => toggleWeeklySlot(s)}
                                          className={
                                             "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
                                             (active
                                                ? "bg-foreground text-background border-foreground"
                                                : "border-hairline text-muted-foreground hover:text-foreground")
                                          }
                                       >
                                          <span>{formatSlotLabel(s)}</span>
                                          {seatsLeft != null ? (
                                             <span
                                                className={
                                                   "rounded-full px-1.5 py-0.5 text-[10px] font-black " +
                                                   (active ? "bg-background/15 text-background" : "bg-[#2fc5b5]/12 text-[#a6eee3]")
                                                }
                                             >
                                                {seatsLeft} seat{seatsLeft === 1 ? "" : "s"}
                                             </span>
                                          ) : null}
                                       </button>
                                    );
                                 })}
                              </div>
                           </div>
                        )}

                        <p className="mt-5 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Series length (weeks)</p>
                        <div className="flex flex-wrap items-center gap-3">
                           <input
                              type="range"
                              min={1}
                              max={maxWeeksForInstructor}
                              value={Math.min(weeks, maxWeeksForInstructor)}
                              onChange={(e) => setWeeks(Number.parseInt(e.target.value, 10))}
                              className="h-2 flex-1 min-w-[8rem] accent-foreground"
                           />
                           <span className="tabular-nums text-sm font-semibold">
                              {Math.min(weeks, maxWeeksForInstructor)} / {maxWeeksForInstructor}
                           </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                           This tutor allows up to {maxWeeksForInstructor} calendar week
                           {maxWeeksForInstructor === 1 ? "" : "s"} per booking.
                        </p>

                        <label htmlFor="svc-msg" className="mt-5 mb-2 block text-[11px] uppercase tracking-widest text-muted-foreground">
                           Message (optional)
                        </label>
                        <textarea
                           id="svc-msg"
                           rows={3}
                           value={requestMessage}
                           maxLength={TUTORING_MESSAGE_MAX}
                           onChange={(e) => setRequestMessage(e.target.value)}
                           placeholder="Goals, repertoire, or anything they should knowâ€¦"
                           className="w-full resize-none rounded-xl border border-hairline bg-background p-3 text-sm outline-none focus:border-foreground"
                        />
                        <p className="mt-1 text-right text-[10px] text-muted-foreground">
                           {requestMessage.length} / {TUTORING_MESSAGE_MAX}
                        </p>
                        <Pill
                           className="mt-4 w-full"
                           disabled={requestSending || !selectedSlots.length || offeredSlots.length === 0 || weeks < 1}
                           onClick={() => void sendServiceRequest()}
                        >
                           {requestSending ? "Sendingâ€¦" : "Send request"}
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
                  <label htmlFor="instructor-dm" className="mt-5 mb-2 block text-[11px] uppercase tracking-widest text-muted-foreground">
                     Message
                  </label>
                  <Textarea
                     id="instructor-dm"
                     value={dmText}
                     onChange={(e) => setDmText(e.target.value.slice(0, 2000))}
                     placeholder={`Hi ${i.fullName.split(" ")[0] ?? "there"}, I'd like to â€¦`}
                     rows={4}
                     disabled={dmSending}
                     className="resize-none"
                  />
                  <p className="mt-1 text-right text-[10px] text-muted-foreground">{dmText.length} / 2000</p>
                  <div className="mt-4 flex gap-2">
                     <Button type="button" variant="outline" className="flex-1" disabled={dmSending} onClick={() => setOpen(null)}>
                        Cancel
                     </Button>
                     <Button type="button" className="flex-1" disabled={dmSending || !dmText.trim()} onClick={() => void sendDm()}>
                        {dmSending ? "Sendingâ€¦" : "Send"}
                     </Button>
                  </div>
               </Sheet>
            )}
         </AnimatePresence>
      </AppShell>
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
