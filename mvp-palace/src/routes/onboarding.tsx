import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pill } from "@/components/musilearn/Pill";
import { Chip } from "@/components/musilearn/Chip";
import { useState } from "react";
import { Camera } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Set up your profile — MusiLearn" }] }),
  component: Onboarding,
});

const SPECIALTIES = ["Voice", "Guitar", "Piano", "Saxophone", "Violin", "Drums", "Bass", "Other"];

function Onboarding() {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [yrs, setYrs] = useState("");
  const [rate, setRate] = useState("");
  const [specs, setSpecs] = useState<string[]>([]);
  const [bio, setBio] = useState("");

  function next() {
    if (step < 2) setStep(step + 1);
    else nav({ to: "/app" });
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
              <button className="flex h-28 w-28 items-center justify-center rounded-full border border-dashed border-hairline bg-surface text-muted-foreground hover:border-foreground hover:text-foreground">
                <Camera className="h-7 w-7" />
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
            <p className="mt-6 mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Specialties</p>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map((s) => {
                const active = specs.includes(s);
                return (
                  <Chip
                    key={s}
                    active={active}
                    onClick={() =>
                      setSpecs((v) => (active ? v.filter((x) => x !== s) : [...v, s]))
                    }
                  >
                    {s}
                  </Chip>
                );
              })}
            </div>
            <input
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              inputMode="numeric"
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

      <Pill size="lg" className="w-full" onClick={next}>
        {step === 2 ? "Complete profile" : "Continue"}
      </Pill>
    </div>
  );
}
