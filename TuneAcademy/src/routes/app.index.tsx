import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Avatar } from "@/components/tuneacademy/Avatar";
import { Pill } from "@/components/tuneacademy/Pill";
import { useAuth } from "@/contexts/AuthContext";
import { brandTheme } from "@/lib/theme";
import { ArrowRight, CalendarDays, Flame, LogOut, Mic, Sparkles, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

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

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Home - TuneAcademy" }] }),
  component: HomeTab,
});

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

function HomeTab() {
  const nav = useNavigate();
  const { userDoc, signOutUser } = useAuth();
  const initials = initialsFromProfile(userDoc?.fullName, userDoc?.email);

  async function onLogout() {
    await signOutUser();
    void nav({ to: "/", replace: true });
  }

  return (
    <AppShell>
      <header className="pt-8">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.22em] ${brandTheme.teal}`}>
              TuneAcademy
            </p>
            <h1 className="mt-2 text-5xl font-black tracking-normal text-[#fffdf5]">
              Today's studio
            </h1>
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
                  className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-[#fffdf5] outline-none data-[highlighted]:bg-[#fffdf5]/10 data-[disabled]:opacity-40"
                  onSelect={() => void onLogout()}
                >
                  <LogOut className="h-4 w-4 shrink-0 text-[#e8f4df]/80" />
                  Log out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>

      <main className="grid gap-5 pt-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.8fr)]">
        <div className="space-y-5">
          <motion.section
            className="overflow-hidden rounded-lg border border-[#fffdf5]/20 bg-[#fffdf5]/12 shadow-[0_24px_90px_rgba(0,0,0,0.28)] backdrop-blur-xl"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="relative min-h-85 p-8 lg:p-10">
              <div className="absolute right-0 top-0 h-56 w-56 rounded-bl-[160px] bg-[#ffd666]/20" />
              <div className="relative max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-lg bg-[#ffd666] px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#11140c]">
                  <Flame className="h-4 w-4" />
                  AI performance review
                </div>
                <h2 className="mt-6 max-w-3xl text-5xl font-black leading-[0.95] tracking-normal">
                  Find your strengths.
                  <br />
                  Fix your weak spots.
                </h2>
                <p className="mt-5 max-w-xl text-lg leading-8 text-[#e8f4df]/80">
                  Record a short take. TuneAcademy finds your strengths, weak spots, next practice
                  steps, and the tutor type that fits.
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
              <div
                key={stat.label}
                className="min-h-36 rounded-lg border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-5"
              >
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#e8f4df]/55">
                  {stat.label}
                </p>
                <p className="mt-8 text-5xl font-black leading-none text-[#fffdf5]">{stat.value}</p>
                {stat.suffix && (
                  <p className="mt-2 text-sm font-semibold text-[#ffd666]">{stat.suffix}</p>
                )}
              </div>
            ))}
          </section>

          <section className="rounded-lg border border-[#fffdf5]/20 bg-[#0b1510]/55 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-black uppercase tracking-[0.18em] ${brandTheme.gold}`}>
                  Practice targets
                </p>
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
        </div>

        <aside className="space-y-5">
          <section className="rounded-lg border border-[#fffdf5]/20 bg-[#fffdf5]/10 p-6 backdrop-blur">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a6eee3]">
                  Progress
                </p>
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

          <section className="grid gap-3">
            <div className="rounded-lg border border-[#ffd666]/35 bg-[#ffd666] p-5 text-[#11140c]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em]">Upcoming</p>
                  <h2 className="mt-3 text-2xl font-black leading-tight">Maya Chen</h2>
                  <p className="mt-1 text-sm font-semibold opacity-75">Jazz piano, timing repair</p>
                </div>
                <CalendarDays className="h-6 w-6" />
              </div>
              <p className="mt-5 rounded-lg bg-[#11140c]/10 px-3 py-2 text-sm font-bold">
                Placeholder session: Apr 22 at 5:00 PM
              </p>
            </div>

            {userDoc?.role === "instructor" ? (
              <Link
                to="/app/students"
                className="flex items-center justify-between rounded-lg border border-[#ffd666]/35 bg-[#ffd666]/12 p-4 text-sm font-bold text-[#ffd666] transition hover:bg-[#ffd666]/18"
              >
                Open student roster
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <Link
                to="/app/instructors"
                search={{ weakness: "Rhythm" }}
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
