import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pill } from "@/components/tuneacademy/Pill";
import { Chip } from "@/components/tuneacademy/Chip";
import { useAuth } from "@/contexts/AuthContext";
import {
  getInstructorDoc,
  instructorOnboardingComplete,
  saveInstructorOnboarding,
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

function Onboarding() {
  const nav = useNavigate();
  const { user, userDoc, loading, refreshUserDoc } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [yrs, setYrs] = useState("");
  const [nationality, setNationality] = useState("");
  const [rate, setRate] = useState("");
  const [specs, setSpecs] = useState<string[]>([]);
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void nav({ to: "/login", replace: true });
      return;
    }
    if (userDoc && userDoc.role !== "instructor") {
      void nav({ to: "/app", replace: true });
      return;
    }
  }, [loading, user, userDoc, nav]);

  useEffect(() => {
    if (userDoc?.fullName) setName((prev) => prev || userDoc.fullName);
  }, [userDoc]);

  useEffect(() => {
    if (!user || loading) return;
    void getInstructorDoc(user.uid).then((inst) => {
      if (instructorOnboardingComplete(inst)) void nav({ to: "/app", replace: true });
    });
  }, [user, loading, nav]);

  function onPickAvatar(f: File | null) {
    setAvatarFile(f);
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(f ? URL.createObjectURL(f) : null);
  }

  async function completeProfile() {
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    if (!u || !userDoc) {
      toast.error("Session expired. Log in again.");
      return;
    }
    const ageN = Number.parseInt(age, 10);
    const yrsN = Number.parseInt(yrs, 10);
    const rateRaw = rate.trim();
    const hourlyRate = rateRaw === "" ? 0 : Number.parseFloat(rateRaw);
    if (!name.trim()) {
      toast.error("Enter your full name.");
      return;
    }
    if (!Number.isFinite(ageN) || ageN < 13 || ageN > 120) {
      toast.error("Enter a valid age.");
      return;
    }
    if (!Number.isFinite(yrsN) || yrsN < 0 || yrsN > 80) {
      toast.error("Enter valid years of experience.");
      return;
    }
    if (!nationality.trim()) {
      toast.error("Choose your nationality.");
      return;
    }
    if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
      toast.error("Enter a valid hourly rate (0 for free).");
      return;
    }
    if (specs.length === 0) {
      toast.error("Pick at least one specialty.");
      return;
    }
    if (!bio.trim()) {
      toast.error("Add a short bio.");
      return;
    }

    setSaving(true);
    let avatarUrl = "";
    if (avatarFile) {
      try {
        avatarUrl = await uploadInstructorAvatar(u.uid, avatarFile);
      } catch {
        toast.error(
          "Photo upload failed. Continuing without a photo — check Storage rules in Firebase.",
        );
      }
    }

    try {
      await saveInstructorOnboarding(u.uid, {
        fullName: name.trim(),
        avatarUrl,
        age: ageN,
        experienceYears: yrsN,
        nationality: nationality.trim(),
        specialties: specs.map(specialtyToSlug),
        bio: bio.trim(),
        hourlyRate,
      });
      await refreshUserDoc();
      toast.success("Profile saved");
      void nav({ to: "/app", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not save profile.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (step === 0) {
      if (!name.trim()) {
        toast.error("Enter your name.");
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      const ageN = Number.parseInt(age, 10);
      const yrsN = Number.parseInt(yrs, 10);
      const rateRaw = rate.trim();
      const hourlyRate = rateRaw === "" ? 0 : Number.parseFloat(rateRaw);
      if (!Number.isFinite(ageN) || ageN < 13) {
        toast.error("Enter a valid age.");
        return;
      }
      if (!Number.isFinite(yrsN) || yrsN < 0) {
        toast.error("Enter years of experience.");
        return;
      }
      if (!nationality.trim()) {
        toast.error("Choose your nationality.");
        return;
      }
      if (!Number.isFinite(hourlyRate) || hourlyRate < 0) {
        toast.error("Enter a valid hourly rate (or leave blank for free).");
        return;
      }
      if (specs.length === 0) {
        toast.error("Pick at least one specialty.");
        return;
      }
      setStep(2);
      return;
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <div className="flex items-center justify-center gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={
              "h-1.5 w-10 rounded-full transition-colors " +
              (i <= step ? "bg-foreground" : "bg-accent")
            }
          />
        ))}
      </div>

      <div className="mt-10 flex-1">
        {step === 0 && (
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Your profile</h2>
            <p className="mt-1 text-sm text-muted-foreground">A photo and your name.</p>
            <div className="mt-8 flex flex-col items-center gap-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-dashed border-hairline bg-surface text-muted-foreground hover:border-foreground hover:text-foreground"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-7 w-7" />
                )}
              </button>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Full name"
                className="h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-sm outline-none focus:border-foreground"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Your details</h2>
            <p className="mt-1 text-sm text-muted-foreground">Tell us what you teach.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <input
                value={age}
                onChange={(e) => setAge(e.target.value)}
                inputMode="numeric"
                placeholder="Age"
                className="h-12 rounded-xl border border-hairline bg-surface px-4 text-sm outline-none focus:border-foreground"
              />
              <input
                value={yrs}
                onChange={(e) => setYrs(e.target.value)}
                inputMode="numeric"
                placeholder="Years experience"
                className="h-12 rounded-xl border border-hairline bg-surface px-4 text-sm outline-none focus:border-foreground"
              />
            </div>
            <label htmlFor="onboarding-nationality" className="sr-only">
              Nationality
            </label>
            <select
              id="onboarding-nationality"
              value={nationality}
              onChange={(e) => setNationality(e.target.value)}
              className="mt-3 h-12 w-full cursor-pointer rounded-xl border border-hairline bg-surface px-4 text-sm text-foreground outline-none focus:border-foreground"
            >
              <option value="">Select nationality…</option>
              {NATIONALITY_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <p className="mt-6 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
              Specialties
            </p>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map((s) => {
                const active = specs.includes(s);
                return (
                  <Chip
                    key={s}
                    active={active}
                    onClick={() => setSpecs((v) => (active ? v.filter((x) => x !== s) : [...v, s]))}
                  >
                    {s}
                  </Chip>
                );
              })}
            </div>
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              inputMode="decimal"
              placeholder="Hourly rate ($) — leave blank if free"
              className="mt-6 h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-sm outline-none focus:border-foreground"
            />
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Short bio</h2>
            <p className="mt-1 text-sm text-muted-foreground">Up to 300 characters.</p>
            <textarea
              value={bio}
              maxLength={300}
              onChange={(e) => setBio(e.target.value)}
              rows={6}
              placeholder="What's your teaching style?"
              className="mt-6 w-full resize-none rounded-xl border border-hairline bg-surface p-4 text-sm outline-none focus:border-foreground"
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">{bio.length}/300</p>
          </div>
        )}
      </div>

      <Pill
        size="lg"
        className="w-full"
        disabled={saving}
        onClick={() => {
          if (step < 2) next();
          else void completeProfile();
        }}
      >
        {step === 2 ? (saving ? "Saving…" : "Complete profile") : "Continue"}
      </Pill>
    </div>
  );
}
