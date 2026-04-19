import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pill } from "@/components/tuneacademy/Pill";
import { Chip } from "@/components/tuneacademy/Chip";
import { useAuth } from "@/contexts/AuthContext";
import { InstructorWeeklyAvailabilityEditor } from "@/components/tuneacademy/InstructorWeeklyAvailabilityEditor";
import { dedupeWeeklySlots, type WeeklyTimeSlot } from "@/lib/scheduling";
import {
  getInstructorDoc,
  instructorOnboardingComplete,
  saveInstructorOnboarding,
  saveLearnerOnboarding,
  uploadLearnerAvatar,
  specialtyToSlug,
  uploadInstructorAvatar,
} from "@/lib/tuneacademyFirestore";
import { getFirebaseAuth } from "@/lib/firebase";
import { NATIONALITY_OPTIONS } from "@/lib/nationalityOptions";
import { Camera } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Set up your profile — TuneAcademy" }] }),
  component: Onboarding,
});

const SPECIALTIES = ["Voice", "Guitar", "Piano", "Saxophone", "Violin", "Drums", "Bass", "Other"];
const INSTRUMENTS = ["Voice", "Guitar", "Piano", "Saxophone", "Violin", "Drums", "Bass", "Other"];
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const TEACHING_LEVELS = ["Beginner", "Intermediate", "Advanced"] as const;
const SESSION_TYPES = [
  { value: "solo", label: "1-on-1", description: "Private sessions only" },
  { value: "group", label: "Group (3:1)", description: "Small group sessions only" },
  { value: "both", label: "Both", description: "Offer both session types" },
] as const;

/** Static onboarding-only options (not persisted). */
const SPECIFIC_STRENGTHS = [
  "Rythm",
  "Pitch Centre",
  "Tone Quality",
  "Pitch Stability",
  "Note Attack",
] as const;

type SessionType = "solo" | "group" | "both";

function Onboarding() {
  const nav = useNavigate();
  const { user, userDoc, loading, refreshUserDoc } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);

  // shared
  const [name, setName] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // instructor fields
  const [age, setAge] = useState("");
  const [yrs, setYrs] = useState("");
  const [nationality, setNationality] = useState("");
  const [rate, setRate] = useState("");
  const [groupRate, setGroupRate] = useState("");
  const [sessionType, setSessionType] = useState<SessionType | "">("");
  const [specs, setSpecs] = useState<string[]>([]);
  const [specificStrengths, setSpecificStrengths] = useState<string[]>([]);
  const [instructorTeachingLevels, setInstructorTeachingLevels] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [weeklyAvailability, setWeeklyAvailability] = useState<WeeklyTimeSlot[]>([]);
  const [groupWeeklyAvailability, setGroupWeeklyAvailability] = useState<WeeklyTimeSlot[]>([]);
  const [maxTutoringWeeks, setMaxTutoringWeeks] = useState("8");

  // learner fields
  const [skillLevel, setSkillLevel] = useState<"beginner" | "intermediate" | "advanced" | "">("");
  const [instruments, setInstruments] = useState<string[]>([]);

  const isLearner = userDoc?.role === "learner";

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void nav({ to: "/login", replace: true });
      return;
    }
  }, [loading, user, nav]);

  useEffect(() => {
    if (userDoc?.fullName) setName((prev) => prev || userDoc.fullName);
  }, [userDoc]);

  useEffect(() => {
    if (!user || loading) return;
    if (!isLearner) {
      void getInstructorDoc(user.uid).then((inst) => {
        if (instructorOnboardingComplete(inst)) void nav({ to: "/app", replace: true });
        else {
          if (inst?.weeklyAvailability?.length) setWeeklyAvailability(inst.weeklyAvailability);
          if (inst?.maxTutoringWeeks != null) setMaxTutoringWeeks(String(inst.maxTutoringWeeks));
          if (inst?.teachingLevels?.length) {
            const cap: Record<string, (typeof TEACHING_LEVELS)[number]> = {
              beginner: "Beginner",
              intermediate: "Intermediate",
              advanced: "Advanced",
            };
            const restored = inst.teachingLevels
              .map((slug) => cap[slug.trim().toLowerCase()])
              .filter((x): x is (typeof TEACHING_LEVELS)[number] => Boolean(x));
            if (restored.length) setInstructorTeachingLevels(restored);
          }
        }
      });
    }
  }, [user, loading, nav, isLearner]);

  function onPickAvatar(f: File | null) {
    setAvatarFile(f);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(f ? URL.createObjectURL(f) : null);
  }

  // ── LEARNER SUBMIT ──────────────────────────────────────────────
  async function completeLearnerProfile() {
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    if (!u) { toast.error("Session expired."); return; }
    if (!name.trim()) { toast.error("Enter your name."); return; }
    if (!skillLevel) { toast.error("Select your skill level."); return; }
    if (instruments.length === 0) { toast.error("Pick at least one instrument."); return; }

    setSaving(true);
    let avatarUrl = "";
    if (avatarFile) {
      try { avatarUrl = await uploadLearnerAvatar(u.uid, avatarFile); }
      catch { toast.error("Photo upload failed. Continuing without photo."); }
    }
    try {
      await saveLearnerOnboarding(u.uid, {
        fullName: name.trim(),
        avatarUrl,
        skillLevel: skillLevel as "beginner" | "intermediate" | "advanced",
        instruments,
      });
      await refreshUserDoc();
      toast.success("Profile saved!");
      void nav({ to: "/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  // ── INSTRUCTOR SUBMIT ───────────────────────────────────────────
  async function completeInstructorProfile() {
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    if (!u || !userDoc) { toast.error("Session expired."); return; }
    const ageN = Number.parseInt(age, 10);
    const yrsN = Number.parseInt(yrs, 10);
    const hourlyRate = rate.trim() === "" ? 0 : Number.parseFloat(rate.trim());
    const groupHourlyRate = groupRate.trim() === "" ? 0 : Number.parseFloat(groupRate.trim());
    if (!name.trim()) { toast.error("Enter your full name."); return; }
    if (!Number.isFinite(ageN) || ageN < 13) { toast.error("Enter a valid age."); return; }
    if (!Number.isFinite(yrsN) || yrsN < 0) { toast.error("Enter years of experience."); return; }
    if (!nationality.trim()) { toast.error("Choose your nationality."); return; }
    if (!sessionType) { toast.error("Select your session type."); return; }
    if (specs.length === 0) { toast.error("Pick at least one specialty."); return; }
    if (instructorTeachingLevels.length === 0) { toast.error("Pick at least one teaching level."); return; }
    if (!bio.trim()) { toast.error("Add a short bio."); return; }
    if (weeklyAvailability.length === 0) { toast.error("Choose at least one available hour."); return; }
    const maxW = Number.parseInt(maxTutoringWeeks, 10);
    if (!Number.isFinite(maxW) || maxW < 1 || maxW > 52) { toast.error("Max weeks must be 1–52."); return; }

    setSaving(true);
    let avatarUrl = "";
    if (avatarFile) {
      try { avatarUrl = await uploadInstructorAvatar(u.uid, avatarFile); }
      catch { toast.error("Photo upload failed."); }
    }
    try {
      await saveInstructorOnboarding(u.uid, {
        fullName: name.trim(), avatarUrl, age: ageN, experienceYears: yrsN,
        nationality: nationality.trim(), specialties: specs.map(specialtyToSlug),
        teachingLevels: instructorTeachingLevels.map((l) => l.toLowerCase()),
        bio: bio.trim(), hourlyRate,
        groupHourlyRate: (sessionType === "group" || sessionType === "both") ? groupHourlyRate : 0,
        sessionType: sessionType as SessionType,
        weeklyAvailability: dedupeWeeklySlots(weeklyAvailability),
        groupWeeklyAvailability: (sessionType === "group" || sessionType === "both")
          ? dedupeWeeklySlots(groupWeeklyAvailability)
          : [],
        maxTutoringWeeks: maxW,
      });
      await refreshUserDoc();
      toast.success("Profile saved");
      void nav({ to: "/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (step === 0) {
      if (!name.trim()) { toast.error("Enter your name."); return; }
      setStep(1); return;
    }
    if (!isLearner) {
      if (step === 1) {
        const ageN = Number.parseInt(age, 10);
        const yrsN = Number.parseInt(yrs, 10);
        const hourlyRate = rate.trim() === "" ? 0 : Number.parseFloat(rate.trim());
        if (!Number.isFinite(ageN) || ageN < 13) { toast.error("Enter a valid age."); return; }
        if (!Number.isFinite(yrsN) || yrsN < 0) { toast.error("Enter years of experience."); return; }
        if (!nationality.trim()) { toast.error("Choose your nationality."); return; }
        if (!Number.isFinite(hourlyRate) || hourlyRate < 0) { toast.error("Enter a valid rate."); return; }
        if (!sessionType) { toast.error("Select your session type."); return; }
        if (specs.length === 0) { toast.error("Pick at least one specialty."); return; }
        if (instructorTeachingLevels.length === 0) { toast.error("Pick at least one teaching level."); return; }
        setStep(2); return;
      }
      if (step === 2) {
        if (weeklyAvailability.length === 0) { toast.error("Pick at least one hour block."); return; }
        const maxW = Number.parseInt(maxTutoringWeeks, 10);
        if (!Number.isFinite(maxW) || maxW < 1 || maxW > 52) { toast.error("Max weeks must be 1–52."); return; }
        setStep(3); return;
      }
    }
  }

  const totalSteps = isLearner ? 2 : 4;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i}
            className={"h-1.5 w-8 rounded-full transition-colors sm:w-10 " +
              (i <= step ? "bg-foreground" : "bg-accent")} />
        ))}
      </div>

      <div className="mt-10 flex-1">

        {/* ── STEP 0: Name + Photo (shared) ── */}
        {step === 0 && (
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Your profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">A photo and your name.</p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-dashed border-hairline bg-surface text-muted-foreground hover:border-foreground hover:text-foreground">
                {avatarPreview
                  ? <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                  : <Camera className="h-7 w-7" />}
              </button>
              <input value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Full name *"
                className="h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-sm outline-none focus:border-foreground" />
            </div>
          </div>
        )}

        {/* ── LEARNER STEP 1: Skill level + instruments ── */}
        {step === 1 && isLearner && (
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Your music journey</h2>
            <p className="mt-1 text-sm text-muted-foreground">Help us personalise your experience.</p>
            <p className="mt-6 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Skill level <span className="text-red-400">*</span>
            </p>
            <div className="flex gap-3">
              {SKILL_LEVELS.map((level) => {
                const active = skillLevel === level.toLowerCase();
                return (
                  <Chip key={level} active={active}
                    onClick={() => setSkillLevel(level.toLowerCase() as any)}>
                    {level}
                  </Chip>
                );
              })}
            </div>
            <p className="mt-6 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Instruments <span className="text-red-400">*</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {INSTRUMENTS.map((inst) => {
                const active = instruments.includes(inst);
                return (
                  <Chip key={inst} active={active}
                    onClick={() => setInstruments((v) => active ? v.filter((x) => x !== inst) : [...v, inst])}>
                    {inst}
                  </Chip>
                );
              })}
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              You can update these anytime from your profile.
            </p>
          </div>
        )}

        {/* ── INSTRUCTOR STEP 1: Details + Session Type ── */}
        {step === 1 && !isLearner && (
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Your details</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tell us what you teach.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric"
                placeholder="Age *"
                className="h-12 rounded-xl border border-hairline bg-surface px-4 text-sm outline-none focus:border-foreground" />
              <input value={yrs} onChange={(e) => setYrs(e.target.value)} inputMode="numeric"
                placeholder="Years experience *"
                className="h-12 rounded-xl border border-hairline bg-surface px-4 text-sm outline-none focus:border-foreground" />
            </div>
            <select value={nationality} onChange={(e) => setNationality(e.target.value)}
              className="mt-3 h-12 w-full cursor-pointer rounded-xl border border-hairline bg-surface px-4 text-sm text-foreground outline-none focus:border-foreground">
              <option value="">Select nationality… *</option>
              {NATIONALITY_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>

            {/* Session Type */}
            <p className="mt-6 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Session type <span className="text-red-400">*</span>
            </p>
            <div className="grid grid-cols-3 gap-2">
              {SESSION_TYPES.map(({ value, label, description }) => {
                const active = sessionType === value;
                return (
                  <button key={value} type="button" onClick={() => setSessionType(value)}
                    className={`flex flex-col items-center rounded-xl border p-3 text-center transition-all ${
                      active
                        ? "border-foreground bg-foreground text-background"
                        : "border-hairline bg-surface text-foreground hover:border-foreground"
                    }`}>
                    <span className="text-sm font-semibold">{label}</span>
                    <span className={`mt-1 text-[10px] ${active ? "text-background/70" : "text-muted-foreground"}`}>
                      {description}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 1-on-1 rate */}
            {(sessionType === "solo" || sessionType === "both") && (
              <input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal"
                placeholder="1-on-1 hourly rate ($) — leave blank if free"
                className="mt-4 h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-sm outline-none focus:border-foreground" />
            )}

            {/* Group rate */}
            {(sessionType === "group" || sessionType === "both") && (
              <input value={groupRate} onChange={(e) => setGroupRate(e.target.value)} inputMode="decimal"
                placeholder="Group session rate per person ($)"
                className="mt-3 h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-sm outline-none focus:border-foreground" />
            )}

            <p className="mt-6 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Specialties *</p>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map((s) => {
                const active = specs.includes(s);
                return <Chip key={s} active={active}
                  onClick={() => setSpecs((v) => active ? v.filter((x) => x !== s) : [...v, s])}>{s}</Chip>;
              })}
            </div>

            <p className="mt-6 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Specific strenghts</p>
            <div className="flex flex-wrap gap-2">
              {SPECIFIC_STRENGTHS.map((s) => {
                const active = specificStrengths.includes(s);
                return (
                  <Chip
                    key={s}
                    active={active}
                    onClick={() =>
                      setSpecificStrengths((v) => (active ? v.filter((x) => x !== s) : [...v, s]))
                    }
                  >
                    {s}
                  </Chip>
                );
              })}
            </div>

            <p className="mt-6 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Levels you want to teach <span className="text-red-400">*</span>
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              Choose every level you are open to working with. Students can match you to their own level.
            </p>
            <div className="flex flex-wrap gap-2">
              {TEACHING_LEVELS.map((level) => {
                const active = instructorTeachingLevels.includes(level);
                return <Chip key={level} active={active}
                  onClick={() => setInstructorTeachingLevels((v) => active ? v.filter((x) => x !== level) : [...v, level])}>{level}</Chip>;
              })}
            </div>
          </div>
        )}

        {/* ── INSTRUCTOR STEP 2: Availability ── */}
        {step === 2 && !isLearner && (
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Weekly availability</h2>
            <p className="mt-1 text-sm text-muted-foreground">Learners only see these hours when they request tutoring.</p>

            {/* 1-on-1 availability */}
            {(sessionType === "solo" || sessionType === "both") && (
              <>
                {sessionType === "both" && (
                  <p className="mt-4 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                    1-on-1 availability
                  </p>
                )}
                <div className="mt-2 max-h-[30vh] overflow-y-auto rounded-xl border border-hairline bg-surface/60 p-4">
                  <InstructorWeeklyAvailabilityEditor value={weeklyAvailability} onChange={setWeeklyAvailability} />
                </div>
              </>
            )}

            {/* Group availability */}
            {(sessionType === "group" || sessionType === "both") && (
              <>
                <p className="mt-4 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                  Group session availability
                </p>
                <div className="mt-2 max-h-[30vh] overflow-y-auto rounded-xl border border-hairline bg-surface/60 p-4">
                  <InstructorWeeklyAvailabilityEditor value={groupWeeklyAvailability} onChange={setGroupWeeklyAvailability} />
                </div>
              </>
            )}

            <label htmlFor="max-weeks" className="mt-6 mb-2 block text-[11px] uppercase tracking-widest text-muted-foreground">
              Maximum weeks per tutoring request
            </label>
            <input id="max-weeks" value={maxTutoringWeeks} onChange={(e) => setMaxTutoringWeeks(e.target.value)}
              inputMode="numeric" placeholder="8"
              className="h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-sm outline-none focus:border-foreground" />
          </div>
        )}

        {/* ── INSTRUCTOR STEP 3: Bio ── */}
        {step === 3 && !isLearner && (
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Short bio</h2>
            <p className="mt-1 text-sm text-muted-foreground">Up to 300 characters.</p>
            <textarea value={bio} maxLength={300} onChange={(e) => setBio(e.target.value)}
              rows={6} placeholder="What's your teaching style? *"
              className="mt-6 w-full resize-none rounded-xl border border-hairline bg-surface p-4 text-sm outline-none focus:border-foreground" />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">{bio.length}/300</p>
          </div>
        )}
      </div>

      <Pill size="lg" className="w-full" disabled={saving}
        onClick={() => {
          if (isLearner) {
            if (step < 1) next();
            else void completeLearnerProfile();
          } else {
            if (step < 3) next();
            else void completeInstructorProfile();
          }
        }}>
        {saving ? "Saving…" : step === (isLearner ? 1 : 3) ? "Complete profile" : "Continue"}
      </Pill>
    </div>
  );
}