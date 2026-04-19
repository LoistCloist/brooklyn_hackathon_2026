import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Avatar } from "@/components/tuneacademy/Avatar";
import { Pill } from "@/components/tuneacademy/Pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { brandTheme } from "@/lib/theme";
import { getFirestoreDb, getFirebaseStorage } from "@/lib/firebase";
import { useFirestoreUserDoc } from "@/hooks/useFirestoreUserDoc";
import { InstructorWeeklyAvailabilityEditor } from "@/components/tuneacademy/InstructorWeeklyAvailabilityEditor";
import { ProfileUpcomingMeetings } from "@/components/tuneacademy/ProfileUpcomingMeetings";
import { dedupeWeeklySlots, type WeeklyTimeSlot } from "@/lib/scheduling";
import {
   LEARNER_BIO_MAX_CHARS,
   type InstructorFirestoreDoc,
   updateInstructorProfileBasics,
   updateInstructorScheduleSettings,
   updateLearnerBio,
   updateLearnerBudgetCap,
} from "@/lib/tuneacademyFirestore";
import { formatSpecialtyLabel } from "@/hooks/useInstructorsDirectory";
import { collection, doc, getDocs, limit, onSnapshot, query, where } from "firebase/firestore";
import { getDownloadURL, ref } from "firebase/storage";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Music, Star, Clock, Users, BookOpen, MapPin, Edit3, Mic, ChevronDown, ChevronUp, LogOut, DollarSign } from "lucide-react";
import { toast } from "sonner";

const profileSearchSchema = z.object({ editBio: z.enum(["1"]).optional() });

export const Route = createFileRoute("/app/profile")({
   validateSearch: (raw) => profileSearchSchema.parse(raw ?? {}),
   head: () => ({ meta: [{ title: "Profile — TuneAcademy" }] }),
   component: ProfileTab,
});

function initialsFromName(name: string | undefined, email: string | undefined): string {
   const n = name?.trim();
   if (n) {
      const parts = n.split(/\s+/).filter(Boolean);
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return `${parts[0][0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase() || "TA";
   }
   const local = email?.split("@")[0]?.trim();
   if (local && local.length >= 2) return local.slice(0, 2).toUpperCase();
   if (local?.[0]) return local[0].toUpperCase();
   return "TA";
}

type ReportRow = { instrument?: string; overallScore?: number; weaknesses?: string[] };

type RecordingRow = {
   id: string;
   name?: string;
   instrument?: string;
   challenge?: string;
   overallScore?: number;
   status?: string;
   createdAt?: { seconds: number } | null;
   audioUrl?: string;
};

function InstructorStarRating({ averageOutOf5, reviewCount }: { averageOutOf5: number; reviewCount: number }) {
   const r = Math.max(0, Math.min(5, averageOutOf5));
   return (
      <div className="space-y-2">
         <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-0.5" aria-label={`Average rating ${r.toFixed(1)} out of 5`}>
               {[0, 1, 2, 3, 4].map((i) => {
                  const fill = Math.min(1, Math.max(0, r - i));
                  return (
                     <span key={i} className="relative h-7 w-7 shrink-0">
                        <Star className="absolute inset-0 h-7 w-7 text-[#fffdf5]/18" strokeWidth={1.35} aria-hidden />
                        <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }} aria-hidden>
                           <Star className="h-7 w-7 fill-[#ffd666] text-[#ffd666]" strokeWidth={0} />
                        </span>
                     </span>
                  );
               })}
            </div>
            <span className="text-sm font-semibold tabular-nums text-[#e8f4df]/70">{reviewCount > 0 ? `${r.toFixed(1)} / 5` : "—"}</span>
         </div>
         <p className="text-xs text-[#e8f4df]/50">
            {reviewCount === 0
               ? "No ratings yet — reviews from learners appear here."
               : `${reviewCount} rating${reviewCount === 1 ? "" : "s"}`}
         </p>
      </div>
   );
}

function ProfileTab() {
   const nav = useNavigate();
   const search = Route.useSearch();
   const { user, userDoc, signOutUser } = useAuth();
   const { user: liveDoc } = useFirestoreUserDoc(user?.uid ?? null);
   const profile = liveDoc ?? userDoc;
   const isInstructor = profile?.role === "instructor";
   const initials = initialsFromName(profile?.fullName, profile?.email);

   const [learnerBioEditing, setLearnerBioEditing] = useState(false);
   const [learnerBioDraft, setLearnerBioDraft] = useState("");
   const [learnerBioSaving, setLearnerBioSaving] = useState(false);
   const [budgetDraft, setBudgetDraft] = useState("");
   const [budgetSaving, setBudgetSaving] = useState(false);

   useEffect(() => {
      if (learnerBioEditing) return;
      setLearnerBioDraft(profile?.bio ?? "");
   }, [profile?.bio, learnerBioEditing]);

   useEffect(() => {
      if (isInstructor) return;
      const p = liveDoc ?? userDoc;
      const c = p?.learningBudgetCapUsd;
      setBudgetDraft(c != null && Number.isFinite(c) ? String(c) : "");
   }, [isInstructor, liveDoc, userDoc]);

   useEffect(() => {
      if (search.editBio !== "1" || isInstructor) return;
      const p = liveDoc ?? userDoc;
      if (!p) return;
      setLearnerBioDraft(p.bio ?? "");
      setLearnerBioEditing(true);
      void nav({ to: "/app/profile", search: {}, replace: true });
   }, [search.editBio, liveDoc, userDoc, isInstructor, nav]);

   const [report, setReport] = useState<ReportRow | null>(null);
   const [reelCount, setReelCount] = useState(0);
   const [instruments, setInstruments] = useState<string[]>([]);
   const [recordings, setRecordings] = useState<RecordingRow[]>([]);
   const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

   const [scheduleSlots, setScheduleSlots] = useState<WeeklyTimeSlot[]>([]);
   const [scheduleMaxWeeks, setScheduleMaxWeeks] = useState("8");
   const [scheduleSaving, setScheduleSaving] = useState(false);
   const [instructorDoc, setInstructorDoc] = useState<InstructorFirestoreDoc | null>(null);
   const [instructorSnapReady, setInstructorSnapReady] = useState(false);

   const [instructorBasicsEditing, setInstructorBasicsEditing] = useState(false);
   const [instructorBasicsDraft, setInstructorBasicsDraft] = useState({ hourlyRate: "", nationality: "", experienceYears: "" });
   const [instructorBasicsSaving, setInstructorBasicsSaving] = useState(false);

   useEffect(() => {
      if (!user?.uid || !isInstructor) {
         setInstructorDoc(null);
         setInstructorSnapReady(false);
         return;
      }
      setInstructorSnapReady(false);
      const db = getFirestoreDb();
      const unsub = onSnapshot(
         doc(db, "instructors", user.uid),
         (snap) => {
            if (!snap.exists()) setInstructorDoc(null);
            else setInstructorDoc(snap.data() as InstructorFirestoreDoc);
            setInstructorSnapReady(true);
         },
         () => {
            setInstructorDoc(null);
            setInstructorSnapReady(true);
         },
      );
      return () => unsub();
   }, [user?.uid, isInstructor]);

   const instructorScheduleKey = useMemo(() => {
      if (!instructorDoc) return "";
      return JSON.stringify({ w: instructorDoc.weeklyAvailability ?? [], m: instructorDoc.maxTutoringWeeks ?? 8 });
   }, [instructorDoc?.weeklyAvailability, instructorDoc?.maxTutoringWeeks]);

   useEffect(() => {
      if (!instructorDoc || !instructorScheduleKey) return;
      if (instructorDoc.weeklyAvailability?.length) {
         setScheduleSlots(instructorDoc.weeklyAvailability);
      } else {
         setScheduleSlots([]);
      }
      setScheduleMaxWeeks(String(instructorDoc.maxTutoringWeeks ?? 8));
   }, [instructorDoc, instructorScheduleKey]);

   useEffect(() => {
      if (instructorBasicsEditing || !instructorDoc) return;
      setInstructorBasicsDraft({
         hourlyRate: String(instructorDoc.hourlyRate ?? 0),
         nationality: instructorDoc.nationality ?? "",
         experienceYears: String(instructorDoc.experienceYears ?? 0),
      });
   }, [instructorDoc, instructorBasicsEditing]);

   useEffect(() => {
      if (!user?.uid) return;
      if (isInstructor) {
         setRecordings([]);
         setReport(null);
         return;
      }
      let cancelled = false;
      const db = getFirestoreDb();

      const allRepQ = query(collection(db, "reports"), where("userId", "==", user.uid), limit(20));
      void getDocs(allRepQ)
         .then(async (snap) => {
            if (cancelled) return;
            const storage = getFirebaseStorage();
            const rows: RecordingRow[] = await Promise.all(
               snap.docs.map(async (d) => {
                  const data = d.data();
                  let audioUrl: string | undefined;
                  try {
                     audioUrl = await getDownloadURL(ref(storage, `recordings/${user.uid}/${d.id}.wav`));
                  } catch {
                     // file not yet in storage (still uploading or pending)
                  }
                  return {
                     id: d.id,
                     name: data.name || undefined,
                     instrument: data.instrument,
                     challenge: data.challenge,
                     overallScore: data.overall_score,
                     status: data.status,
                     createdAt: data.createdAt ?? null,
                     audioUrl,
                  } as RecordingRow;
               }),
            );
            if (cancelled) return;
            // sort newest first client-side
            rows.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
            setRecordings(rows);
            // derive latest report for AI Skills Analysis section
            const latest = rows.find((r) => r.overallScore != null) ?? rows[0];
            if (latest) {
               setReport({ instrument: latest.instrument, overallScore: latest.overallScore });
            }
         })
         .catch(() => {});

      const reelQ = query(collection(db, "reels"), where("uploaderId", "==", user.uid));
      void getDocs(reelQ)
         .then((snap) => {
            if (cancelled) return;
            setReelCount(snap.size);
            const instSet = new Set<string>();
            snap.docs.forEach((d) => {
               const inst = d.data().instrument as string | undefined;
               if (inst) instSet.add(inst);
            });
            setInstruments([...instSet]);
         })
         .catch(() => {});

      return () => {
         cancelled = true;
      };
   }, [user?.uid, isInstructor]);

   async function onLogout() {
      await signOutUser();
      void nav({ to: "/", replace: true });
   }

   async function saveInstructorSchedule() {
      if (!user?.uid || !isInstructor) return;
      const n = Number.parseInt(scheduleMaxWeeks, 10);
      if (!Number.isFinite(n) || n < 1 || n > 52) {
         toast.error("Max weeks must be between 1 and 52.");
         return;
      }
      if (scheduleSlots.length === 0) {
         toast.error("Pick at least one hour block.");
         return;
      }
      setScheduleSaving(true);
      try {
         await updateInstructorScheduleSettings(user.uid, { weeklyAvailability: dedupeWeeklySlots(scheduleSlots), maxTutoringWeeks: n });
         toast.success("Schedule updated");
      } catch (e) {
         toast.error(e instanceof Error ? e.message : "Could not save schedule.");
      } finally {
         setScheduleSaving(false);
      }
   }

   async function saveInstructorBasics() {
      if (!user?.uid || !isInstructor) return;
      const rate = Number.parseInt(instructorBasicsDraft.hourlyRate, 10);
      const years = Number.parseInt(instructorBasicsDraft.experienceYears, 10);
      if (!Number.isFinite(rate) || rate < 0) {
         toast.error("Hourly rate must be a whole number of dollars (0 or more).");
         return;
      }
      if (!Number.isFinite(years) || years < 0 || years > 80) {
         toast.error("Tutoring experience must be between 0 and 80 years.");
         return;
      }
      setInstructorBasicsSaving(true);
      try {
         await updateInstructorProfileBasics(user.uid, {
            hourlyRate: rate,
            nationality: instructorBasicsDraft.nationality,
            experienceYears: years,
         });
         toast.success("Profile updated");
         setInstructorBasicsEditing(false);
      } catch (e) {
         toast.error(e instanceof Error ? e.message : "Could not save profile.");
      } finally {
         setInstructorBasicsSaving(false);
      }
   }

   async function saveLearnerBudget() {
      if (!user?.uid || isInstructor) return;
      const raw = budgetDraft.trim();
      const n = raw === "" ? 0 : Number.parseFloat(raw);
      if (!Number.isFinite(n) || n < 0) {
         toast.error("Enter a valid budget (0 or more).");
         return;
      }
      setBudgetSaving(true);
      try {
         await updateLearnerBudgetCap(user.uid, n);
         toast.success(n === 0 ? "Budget cleared." : "Budget saved.");
      } catch (e) {
         toast.error(e instanceof Error ? e.message : "Could not save budget.");
      } finally {
         setBudgetSaving(false);
      }
   }

   async function saveLearnerBio() {
      if (!user?.uid || isInstructor) return;
      if (learnerBioDraft.length > LEARNER_BIO_MAX_CHARS) {
         toast.error(`Bio must be ${LEARNER_BIO_MAX_CHARS} characters or less.`);
         return;
      }
      setLearnerBioSaving(true);
      try {
         await updateLearnerBio(user.uid, learnerBioDraft);
         toast.success("Bio saved");
         setLearnerBioEditing(false);
      } catch (e) {
         toast.error(e instanceof Error ? e.message : "Could not save bio.");
      } finally {
         setLearnerBioSaving(false);
      }
   }

   function cancelLearnerBioEdit() {
      setLearnerBioDraft(profile?.bio ?? "");
      setLearnerBioEditing(false);
   }

   const studentStats = [
      { label: "Sessions", value: "12", icon: <BookOpen className="h-4 w-4" />, color: "text-[#ffd666]" },
      { label: "Hours learned", value: "24", icon: <Clock className="h-4 w-4" />, color: "text-[#a6eee3]" },
      { label: "Tutors had", value: "3", icon: <Users className="h-4 w-4" />, color: "text-[#ffd666]" },
      { label: "Day streak", value: "6", icon: <Flame className="h-4 w-4" />, color: "text-[#ff6b6b]" },
   ];

   return (
      <AppShell>
         <header className="pt-8">
            <div className="flex items-center justify-between">
               <div>
                  <p className={`text-xs font-black uppercase tracking-[0.22em] ${brandTheme.teal}`}>TuneAcademy</p>
                  <h1 className="mt-2 text-4xl font-black text-[#fffdf5]">My Profile</h1>
               </div>
               <button
                  type="button"
                  onClick={() => {
                     if (isInstructor) {
                        if (instructorDoc) {
                           setInstructorBasicsDraft({
                              hourlyRate: String(instructorDoc.hourlyRate ?? 0),
                              nationality: instructorDoc.nationality ?? "",
                              experienceYears: String(instructorDoc.experienceYears ?? 0),
                           });
                        }
                        setInstructorBasicsEditing(true);
                        return;
                     }
                     setLearnerBioDraft(profile?.bio ?? "");
                     setLearnerBioEditing(true);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-[#fffdf5]/15 bg-[#fffdf5]/8 text-[#fffdf5]/70 transition hover:bg-[#fffdf5]/14"
                  aria-label={isInstructor ? "Edit teaching profile" : "Edit bio"}
               >
                  <Edit3 className="h-4 w-4" />
               </button>
            </div>
         </header>

         <main className="mt-8 space-y-5 pb-28">
            <motion.section
               className="rounded-xl border border-[#fffdf5]/20 bg-[#fffdf5]/8 p-6 backdrop-blur"
               initial={{ opacity: 0, y: 16 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
               <div className="flex items-center gap-5">
                  <div className="relative">
                     {profile?.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="" className="h-20 w-20 rounded-full object-cover ring-2 ring-[#ffd666]/50" />
                     ) : (
                        <Avatar initials={initials} size={80} />
                     )}
                     {isInstructor && (
                        <span className="absolute -bottom-1 -right-1 rounded-full bg-[#ffd666] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#11140c]">
                           Tutor
                        </span>
                     )}
                  </div>
                  <div className="min-w-0 flex-1">
                     <h2 className="truncate text-xl font-black text-[#fffdf5]">{profile?.fullName || "Your Name"}</h2>
                     <p className="mt-0.5 truncate text-sm text-[#e8f4df]/60">{profile?.email || ""}</p>
                     {isInstructor && instructorSnapReady && !instructorBasicsEditing && instructorDoc && (
                        <dl className="mt-3 space-y-1.5 text-xs text-[#e8f4df]/65">
                           <div className="flex flex-wrap items-center gap-1.5">
                              <dt className="font-bold uppercase tracking-wider text-[#e8f4df]/45">Rate</dt>
                              <dd className="font-semibold text-[#fffdf5]/90">
                                 {instructorDoc.hourlyRate === 0 ? "Free" : `$${instructorDoc.hourlyRate}/hr`}
                              </dd>
                           </div>
                           {instructorDoc.nationality?.trim() ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                 <dt className="sr-only">Nationality</dt>
                                 <dd className="flex items-center gap-1.5">
                                    <MapPin className="h-3 w-3 shrink-0 text-[#a6eee3]/70" />
                                    <span>{instructorDoc.nationality.trim()}</span>
                                 </dd>
                              </div>
                           ) : null}
                           <div className="flex flex-wrap items-center gap-1.5">
                              <dt className="font-bold uppercase tracking-wider text-[#e8f4df]/45">Experience</dt>
                              <dd className="font-semibold text-[#fffdf5]/90">{instructorDoc.experienceYears ?? 0} yrs tutoring</dd>
                           </div>
                        </dl>
                     )}
                     {isInstructor && instructorBasicsEditing && (
                        <div className="mt-4 space-y-3 border-t border-[#fffdf5]/10 pt-4">
                           <p className={`text-xs font-black uppercase tracking-[0.18em] ${brandTheme.gold}`}>Teaching profile</p>
                           <label className="block text-[11px] font-bold uppercase tracking-widest text-[#e8f4df]/45">
                              Hourly wage (USD)
                           </label>
                           <input
                              value={instructorBasicsDraft.hourlyRate}
                              onChange={(e) => setInstructorBasicsDraft((d) => ({ ...d, hourlyRate: e.target.value }))}
                              inputMode="numeric"
                              className="h-10 w-full max-w-xs rounded-lg border border-[#fffdf5]/15 bg-[#0b1510]/70 px-3 text-sm font-semibold text-[#fffdf5] outline-none focus:border-[#ffd666]/50"
                           />
                           <label className="block text-[11px] font-bold uppercase tracking-widest text-[#e8f4df]/45">Nationality</label>
                           <input
                              value={instructorBasicsDraft.nationality}
                              onChange={(e) => setInstructorBasicsDraft((d) => ({ ...d, nationality: e.target.value }))}
                              placeholder="e.g. United States"
                              className="h-10 w-full max-w-xs rounded-lg border border-[#fffdf5]/15 bg-[#0b1510]/70 px-3 text-sm font-semibold text-[#fffdf5] outline-none focus:border-[#ffd666]/50"
                           />
                           <label className="block text-[11px] font-bold uppercase tracking-widest text-[#e8f4df]/45">
                              Tutoring experience (years)
                           </label>
                           <input
                              value={instructorBasicsDraft.experienceYears}
                              onChange={(e) => setInstructorBasicsDraft((d) => ({ ...d, experienceYears: e.target.value }))}
                              inputMode="numeric"
                              className="h-10 w-full max-w-xs rounded-lg border border-[#fffdf5]/15 bg-[#0b1510]/70 px-3 text-sm font-semibold text-[#fffdf5] outline-none focus:border-[#ffd666]/50"
                           />
                           <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                 type="button"
                                 size="sm"
                                 className="bg-[#ffd666] text-[#11140c] hover:bg-[#ffd666]/90"
                                 disabled={instructorBasicsSaving}
                                 onClick={() => void saveInstructorBasics()}
                              >
                                 {instructorBasicsSaving ? "Saving…" : "Save"}
                              </Button>
                              <Button
                                 type="button"
                                 size="sm"
                                 variant="outline"
                                 className="border-[#fffdf5]/20 text-[#fffdf5] hover:bg-[#fffdf5]/10"
                                 disabled={instructorBasicsSaving}
                                 onClick={() => {
                                    if (instructorDoc) {
                                       setInstructorBasicsDraft({
                                          hourlyRate: String(instructorDoc.hourlyRate ?? 0),
                                          nationality: instructorDoc.nationality ?? "",
                                          experienceYears: String(instructorDoc.experienceYears ?? 0),
                                       });
                                    }
                                    setInstructorBasicsEditing(false);
                                 }}
                              >
                                 Cancel
                              </Button>
                           </div>
                        </div>
                     )}
                  </div>
               </div>
               {isInstructor && instructorDoc?.bio?.trim() && !instructorBasicsEditing && (
                  <p className="mt-4 border-t border-[#fffdf5]/10 pt-4 text-sm leading-6 text-[#e8f4df]/75">{instructorDoc.bio}</p>
               )}

               {!isInstructor && (
                  <div className="mt-4 border-t border-[#fffdf5]/10 pt-4">
                     <p className={`text-xs font-black uppercase tracking-[0.18em] ${brandTheme.gold}`}>About you</p>
                     {learnerBioEditing ? (
                        <div className="mt-3 space-y-3">
                           <Textarea
                              value={learnerBioDraft}
                              onChange={(e) => setLearnerBioDraft(e.target.value)}
                              placeholder="Tell instructors what you’re working on, your style, and what you’d like to learn…"
                              className="min-h-[100px] border-[#fffdf5]/20 bg-[#fffdf5]/6 text-[#fffdf5] placeholder:text-[#e8f4df]/35"
                              maxLength={LEARNER_BIO_MAX_CHARS}
                           />
                           <div className="flex items-center justify-between gap-2 text-xs text-[#e8f4df]/45">
                              <span>
                                 {learnerBioDraft.length}/{LEARNER_BIO_MAX_CHARS}
                              </span>
                           </div>
                           <div className="flex gap-2">
                              <Button
                                 type="button"
                                 size="sm"
                                 className="bg-[#ffd666] text-[#11140c] hover:bg-[#ffd666]/90"
                                 disabled={learnerBioSaving}
                                 onClick={() => void saveLearnerBio()}
                              >
                                 {learnerBioSaving ? "Saving…" : "Save bio"}
                              </Button>
                              <Button
                                 type="button"
                                 size="sm"
                                 variant="outline"
                                 className="border-[#fffdf5]/20 text-[#fffdf5] hover:bg-[#fffdf5]/10"
                                 disabled={learnerBioSaving}
                                 onClick={cancelLearnerBioEdit}
                              >
                                 Cancel
                              </Button>
                           </div>
                        </div>
                     ) : profile?.bio?.trim() ? (
                        <p className="mt-3 text-sm leading-6 text-[#e8f4df]/75">{profile.bio}</p>
                     ) : (
                        <p className="mt-3 text-sm text-[#e8f4df]/50">
                           No bio yet — tap the pencil above to introduce yourself to instructors.
                        </p>
                     )}
                  </div>
               )}
            </motion.section>

            {profile?.role === "learner" || profile?.role === "instructor" ? <ProfileUpcomingMeetings /> : null}

            {!isInstructor && (
               <motion.section
                  className="rounded-xl border border-[#2fc5b5]/40 bg-[#0b1510]/80 p-6"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
               >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                     <div className="min-w-0 flex-1">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a6eee3]">Learning budget</p>
                        <p className="mt-3 flex flex-wrap items-center gap-2 text-[#fffdf5]">
                           <span className="text-2xl font-black tracking-tight">Budget:</span>
                           <span className="sr-only">Amount in USD</span>
                           <Input
                              type="number"
                              min={0}
                              step={1}
                              inputMode="decimal"
                              value={budgetDraft}
                              onChange={(e) => setBudgetDraft(e.target.value)}
                              placeholder="0"
                              className="h-12 max-w-[11rem] border-[#2fc5b5]/35 bg-[#fffdf5]/10 text-xl font-black text-[#fffdf5] placeholder:text-[#e8f4df]/35"
                           />
                           <span className="text-lg font-bold text-[#e8f4df]/70">USD</span>
                        </p>
                        <p className="mt-3 text-sm leading-relaxed text-[#e8f4df]/70">
                           Completed sessions deduct{" "}
                           <span className="font-semibold text-[#fffdf5]/90">scheduled hours × your tutor’s hourly rate</span>. Set a cap to
                           track what you’re willing to spend.
                        </p>
                        {(liveDoc ?? userDoc)?.learningBudgetSpentUsd != null && ((liveDoc ?? userDoc)?.learningBudgetSpentUsd ?? 0) > 0 ? (
                           <p className="mt-2 text-sm font-semibold text-[#2fc5b5]">
                              Spent so far:{" "}
                              {new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
                                 (liveDoc ?? userDoc)?.learningBudgetSpentUsd ?? 0,
                              )}
                              {(liveDoc ?? userDoc)?.learningBudgetCapUsd != null ? (
                                 <>
                                    {" "}
                                    · Remaining:{" "}
                                    <span
                                       className={
                                          ((liveDoc ?? userDoc)?.learningBudgetCapUsd ?? 0) -
                                             ((liveDoc ?? userDoc)?.learningBudgetSpentUsd ?? 0) <
                                          0
                                             ? "text-[#ff6b6b]"
                                             : "text-[#ffd666]"
                                       }
                                    >
                                       {new Intl.NumberFormat(undefined, {
                                          style: "currency",
                                          currency: "USD",
                                          maximumFractionDigits: 0,
                                       }).format(
                                          ((liveDoc ?? userDoc)?.learningBudgetCapUsd ?? 0) -
                                             ((liveDoc ?? userDoc)?.learningBudgetSpentUsd ?? 0),
                                       )}
                                    </span>
                                 </>
                              ) : null}
                           </p>
                        ) : null}
                        <div className="mt-4 flex flex-wrap gap-2">
                           <Button
                              type="button"
                              className="bg-[#2fc5b5] text-[#11140c] hover:bg-[#2fc5b5]/90"
                              disabled={budgetSaving}
                              onClick={() => void saveLearnerBudget()}
                           >
                              {budgetSaving ? "Saving…" : "Save budget"}
                           </Button>
                        </div>
                     </div>
                     <DollarSign className="h-10 w-10 shrink-0 text-[#2fc5b5]/90" aria-hidden />
                  </div>
               </motion.section>
            )}

            {!isInstructor && (
               <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
               >
                  <p className={`mb-3 text-xs font-black uppercase tracking-[0.18em] ${brandTheme.gold}`}>Your progress</p>
                  <div className="grid grid-cols-2 gap-3">
                     {studentStats.map((stat) => (
                        <div key={stat.label} className="rounded-lg border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-4">
                           <div className={`mb-2 ${stat.color}`}>{stat.icon}</div>
                           <p className="text-3xl font-black text-[#fffdf5]">{stat.value}</p>
                           <p className="mt-1 text-xs font-semibold text-[#e8f4df]/55">{stat.label}</p>
                        </div>
                     ))}
                  </div>
               </motion.section>
            )}

            {isInstructor && instructorSnapReady && (
               <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-xl border border-[#fffdf5]/20 bg-[#fffdf5]/8 p-6"
               >
                  <p className={`mb-4 text-xs font-black uppercase tracking-[0.18em] ${brandTheme.gold}`}>Teaching details</p>
                  {instructorDoc ? (
                     <InstructorStarRating averageOutOf5={instructorDoc.rating ?? 0} reviewCount={instructorDoc.reviewCount ?? 0} />
                  ) : (
                     <p className="text-sm text-[#e8f4df]/55">Finish onboarding to show your teaching stats.</p>
                  )}
               </motion.section>
            )}

            {isInstructor && instructorSnapReady && (
               <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-xl border border-[#2fc5b5]/25 bg-[#0b1510]/55 p-6"
               >
                  <p className={`mb-1 text-xs font-black uppercase tracking-[0.18em] ${brandTheme.teal}`}>Calendar</p>
                  <h3 className="text-lg font-black text-[#fffdf5]">Teaching availability</h3>
                  <p className="mt-2 text-sm text-[#e8f4df]/60">
                     Learners only see these hours when requesting services. Busy slots from accepted students are hidden automatically.
                  </p>
                  <div className="mt-5 max-h-[min(420px,55vh)] overflow-y-auto rounded-xl border border-[#fffdf5]/12 bg-[#fffdf5]/5 p-4">
                     <InstructorWeeklyAvailabilityEditor variant="studio" value={scheduleSlots} onChange={setScheduleSlots} />
                  </div>
                  <label
                     htmlFor="profile-max-weeks"
                     className="mt-5 mb-2 block text-[11px] font-black uppercase tracking-widest text-[#e8f4df]/45"
                  >
                     Max weeks per request
                  </label>
                  <input
                     id="profile-max-weeks"
                     value={scheduleMaxWeeks}
                     onChange={(e) => setScheduleMaxWeeks(e.target.value)}
                     inputMode="numeric"
                     className="h-11 w-full max-w-xs rounded-lg border border-[#fffdf5]/15 bg-[#0b1510]/70 px-3 text-sm font-semibold text-[#fffdf5] outline-none focus:border-[#ffd666]/50"
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                     <Button
                        type="button"
                        size="sm"
                        className="bg-[#ffd666] text-[#11140c] hover:bg-[#ffd666]/90"
                        disabled={scheduleSaving}
                        onClick={() => void saveInstructorSchedule()}
                     >
                        {scheduleSaving ? "Saving…" : "Save schedule"}
                     </Button>
                  </div>
               </motion.section>
            )}

            {!isInstructor && (
               <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-xl border border-[#ffd666]/30 bg-[#ffd666]/8 p-6"
               >
                  <div className="mb-4 flex items-center justify-between">
                     <div>
                        <p className={`text-xs font-black uppercase tracking-[0.18em] ${brandTheme.gold}`}>Profile rating</p>
                        <h3 className="mt-1 text-lg font-black text-[#fffdf5]">AI Skills Analysis</h3>
                     </div>
                     <Star className="h-5 w-5 text-[#ffd666]" />
                  </div>
                  {report ? (
                     <div className="space-y-3">
                        <div className="flex items-baseline gap-2">
                           <span className="text-5xl font-black text-[#ffd666]">{report.overallScore ?? "—"}</span>
                           <span className="text-lg font-bold text-[#e8f4df]/55">/100</span>
                        </div>
                        <p className="text-xs font-semibold capitalize text-[#e8f4df]/60">Instrument: {report.instrument ?? "—"}</p>
                        {(report.weaknesses ?? []).length > 0 && (
                           <div className="mt-3 space-y-1.5">
                              <p className="text-xs font-bold uppercase tracking-widest text-[#e8f4df]/45">Focus areas</p>
                              {(report.weaknesses ?? []).slice(0, 3).map((w, i) => (
                                 <div
                                    key={i}
                                    className="flex items-start gap-2 rounded-lg bg-[#fffdf5]/6 px-3 py-2 text-sm text-[#e8f4df]/75"
                                 >
                                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffd666]" />
                                    {w}
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  ) : (
                     <div className="py-4 text-center">
                        <p className="text-sm text-[#e8f4df]/55">No analysis yet.</p>
                        <Link to="/app/analyze">
                           <Pill className={`mt-4 ${brandTheme.primaryButton}`} size="sm">
                              Record your first take
                           </Pill>
                        </Link>
                     </div>
                  )}
               </motion.section>
            )}

            <motion.section
               initial={{ opacity: 0, y: 16 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.5, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
               className="rounded-xl border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-6"
            >
               <div className="mb-4 flex items-center gap-2">
                  <Music className="h-4 w-4 text-[#a6eee3]" />
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a6eee3]">
                     {isInstructor ? "Specialties" : "Instruments played"}
                  </p>
               </div>
               <div className="flex flex-wrap gap-2">
                  {isInstructor ? (
                     instructorDoc?.specialties?.length ? (
                        instructorDoc.specialties.map((slug) => (
                           <span
                              key={slug}
                              className="rounded-full border border-[#a6eee3]/30 bg-[#a6eee3]/10 px-3 py-1 text-xs font-bold text-[#a6eee3]"
                           >
                              {formatSpecialtyLabel(slug)}
                           </span>
                        ))
                     ) : (
                        <p className="text-sm text-[#e8f4df]/55">No specialties listed.</p>
                     )
                  ) : instruments.length ? (
                     instruments.map((inst) => (
                        <span
                           key={inst}
                           className="rounded-full border border-[#a6eee3]/30 bg-[#a6eee3]/10 px-3 py-1 text-xs font-bold capitalize text-[#a6eee3]"
                        >
                           {inst}
                        </span>
                     ))
                  ) : (
                     <p className="text-sm text-[#e8f4df]/55">Post a reel to show your instruments.</p>
                  )}
               </div>
            </motion.section>

            {reelCount > 0 && (
               <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  className="rounded-xl border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-6"
               >
                  <div className="flex items-center justify-between">
                     <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e8f4df]/55">Your reels</p>
                        <p className="mt-2 text-4xl font-black text-[#fffdf5]">{reelCount}</p>
                     </div>
                     <Link
                        to="/app/musireels"
                        className="rounded-lg border border-[#fffdf5]/15 bg-[#fffdf5]/8 px-4 py-2 text-xs font-bold text-[#fffdf5] transition hover:bg-[#fffdf5]/14"
                     >
                        View all →
                     </Link>
                  </div>
               </motion.section>
            )}

            {!isInstructor && (
               <motion.section
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-xl border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-6"
               >
                  <div className="mb-4 flex items-center gap-2">
                     <Mic className="h-4 w-4 text-[#a6eee3]" />
                     <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a6eee3]">My Recordings</p>
                  </div>
                  {recordings.length === 0 ? (
                     <div className="py-4 text-center">
                        <p className="text-sm text-[#e8f4df]/55">No recordings yet.</p>
                        <Link to="/app/analyze">
                           <Pill className={`mt-4 ${brandTheme.primaryButton}`} size="sm">
                              Record your first take
                           </Pill>
                        </Link>
                     </div>
                  ) : (
                     <div className="space-y-3">
                        {recordings.map((rec) => {
                           const date = rec.createdAt?.seconds
                              ? new Date(rec.createdAt.seconds * 1000).toLocaleDateString(undefined, {
                                   month: "short",
                                   day: "numeric",
                                   year: "numeric",
                                })
                              : null;
                           const expanded = expandedIds.has(rec.id);
                           const toggleExpand = () =>
                              setExpandedIds((prev) => {
                                 const next = new Set(prev);
                                 if (next.has(rec.id)) next.delete(rec.id);
                                 else next.add(rec.id);
                                 return next;
                              });
                           return (
                              <div key={rec.id} className="rounded-lg border border-[#fffdf5]/10 bg-[#fffdf5]/5 p-4 space-y-2">
                                 <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                       <p className="truncate text-sm font-bold text-[#fffdf5]">
                                          {rec.name || `${rec.instrument ?? "Recording"} take`}
                                       </p>
                                       <div className="mt-1 flex items-center gap-2">
                                          <span className="rounded-full border border-[#a6eee3]/30 bg-[#a6eee3]/10 px-2 py-0.5 text-[10px] font-bold capitalize text-[#a6eee3]">
                                             {rec.instrument ?? "Unknown"}
                                          </span>
                                          {rec.overallScore != null && (
                                             <span className="text-xs font-bold text-[#ffd666]">{rec.overallScore}/100</span>
                                          )}
                                       </div>
                                    </div>
                                    {date && <span className="shrink-0 text-xs text-[#e8f4df]/40">{date}</span>}
                                 </div>
                                 {rec.audioUrl && (
                                    <audio controls src={rec.audioUrl} className="w-full mt-1" style={{ colorScheme: "dark" }} />
                                 )}
                                 <button
                                    onClick={toggleExpand}
                                    className="flex w-full items-center justify-between pt-1 text-xs font-semibold text-[#e8f4df]/50 transition hover:text-[#e8f4df]/80"
                                 >
                                    <span>View Analysis</span>
                                    {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                 </button>
                                 {expanded && (
                                    <div className="mt-1 space-y-2 rounded-lg border border-[#fffdf5]/8 bg-[#fffdf5]/4 px-3 py-3">
                                       {rec.status === "pending" || rec.overallScore == null ? (
                                          <p className="text-xs text-[#e8f4df]/45 text-center py-1">
                                             Analysis in progress — check back soon.
                                          </p>
                                       ) : (
                                          <>
                                             <p className="text-xs font-bold uppercase tracking-widest text-[#e8f4df]/40 mb-2">Breakdown</p>
                                             {["Pitch accuracy", "Rhythm", "Tone quality", "Note attack", "Pitch stability"].map(
                                                (label) => (
                                                   <div key={label} className="space-y-1">
                                                      <div className="flex justify-between text-xs text-[#e8f4df]/55">
                                                         <span>{label}</span>
                                                         <span className="text-[#ffd666]/60">—</span>
                                                      </div>
                                                      <div className="h-1.5 w-full rounded-full bg-[#fffdf5]/8" />
                                                   </div>
                                                ),
                                             )}
                                          </>
                                       )}
                                    </div>
                                 )}
                              </div>
                           );
                        })}
                     </div>
                  )}
               </motion.section>
            )}

            <motion.div
               initial={{ opacity: 0, y: 16 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ duration: 0.5, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
               <button
                  type="button"
                  onClick={() => void onLogout()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/12 py-3.5 text-sm font-bold text-red-100 transition hover:bg-red-500/20"
               >
                  <LogOut className="h-4 w-4 text-red-200" />
                  Log out
               </button>
            </motion.div>
         </main>
      </AppShell>
   );
}
