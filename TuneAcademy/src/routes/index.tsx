import { createFileRoute, Link } from "@tanstack/react-router";
import { Pill } from "@/components/musilearn/Pill";
import { brandTheme, musicImages } from "@/lib/theme";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TuneAcademy - AI-powered music instruction" },
      {
        name: "description",
        content:
          "TuneAcademy turns a recorded performance into a focused weakness profile and instructor match.",
      },
      { property: "og:title", content: "TuneAcademy - AI-powered music instruction" },
      {
        property: "og:description",
        content: "Record a take, find the gap, and match with the instructor who can fix it.",
      },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  const notes = ["A", "C#", "F", "G", "Bb", "D", "E"];

  return (
    <div className={`relative min-h-screen overflow-hidden ${brandTheme.page}`}>
      <img
        src={musicImages.studio}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-50"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,18,14,0.96)_0%,rgba(8,18,14,0.72)_42%,rgba(8,18,14,0.28)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_18%,rgba(255,214,102,0.32),transparent_30%),radial-gradient(circle_at_78%_78%,rgba(47,197,181,0.28),transparent_32%),radial-gradient(circle_at_16%_70%,rgba(255,88,88,0.18),transparent_26%)]" />

      <div className="pointer-events-none absolute inset-x-0 top-24 hidden h-48 rotate-[-7deg] border-y border-[#fffdf5]/15 opacity-70 md:block">
        <div className="absolute left-0 top-1/4 h-px w-full bg-[#fffdf5]/15" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-[#fffdf5]/15" />
        <div className="absolute left-0 top-3/4 h-px w-full bg-[#fffdf5]/15" />
        {notes.map((note, index) => (
          <motion.span
            key={note}
            className="absolute text-4xl font-black text-[#ffd666]"
            style={{ left: `${14 + index * 12}%`, top: `${index % 2 === 0 ? 18 : 56}%` }}
            animate={{ y: [0, -12, 0], rotate: [-4, 5, -4] }}
            transition={{ duration: 4 + index * 0.35, repeat: Infinity, ease: "easeInOut" }}
          >
            {note}
          </motion.span>
        ))}
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <Link to="/" className={`text-sm font-black uppercase tracking-[0.24em] ${brandTheme.ink}`}>
            TuneAcademy
          </Link>
          <nav className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-lg border border-[#fffdf5]/30 px-4 py-2 text-sm font-semibold text-[#fffdf5] transition hover:border-[#fffdf5] hover:bg-[#fffdf5] hover:text-[#0b1510]"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              search={{ role: "learner" }}
              className="rounded-lg border border-[#ffd666] bg-[#ffd666] px-4 py-2 text-sm font-black text-[#11140c] shadow-[0_14px_36px_rgba(255,214,102,0.24)] transition hover:bg-[#ffe08a]"
            >
              Sign up
            </Link>
          </nav>
        </header>

        <main className="grid flex-1 items-center gap-10 py-12 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)] xl:py-8">
          <motion.section
            className="max-w-4xl"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className={`mb-5 inline-flex rounded-lg border border-[#ffd666]/40 bg-[#0b1510]/45 px-3 py-2 text-xs font-bold uppercase tracking-[0.22em] ${brandTheme.gold} backdrop-blur`}>
              Tune the lesson to the player
            </p>
            <h1 className={`max-w-4xl text-5xl font-black leading-[0.88] tracking-normal sm:text-6xl lg:text-7xl ${brandTheme.ink}`}>
              Hear the flaw.
              <span className={`block ${brandTheme.gold}`}>Find the teacher.</span>
              Fix the next take.
            </h1>
            <p className={`mt-6 max-w-2xl text-lg leading-8 sm:text-xl ${brandTheme.inkSoft}`}>
              Record a performance, get a focused weakness profile, and match with instructors who
              know exactly what to sharpen next.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup" search={{ role: "learner" }}>
                <Pill
                  size="lg"
                  className={`w-full px-7 sm:w-auto ${brandTheme.primaryButton}`}
                >
                  Start learning
                </Pill>
              </Link>
              <Link to="/signup" search={{ role: "instructor" }}>
                <Pill
                  size="lg"
                  variant="secondary"
                  className={`w-full px-7 sm:w-auto ${brandTheme.secondaryButton}`}
                >
                  Teach on TuneAcademy
                </Pill>
              </Link>
            </div>
          </motion.section>

          <motion.section
            className="relative min-h-[600px] w-full max-w-[560px] justify-self-center xl:min-h-[560px] xl:justify-self-end"
            initial={{ opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            aria-label="TuneAcademy sample analysis"
          >
            <div className="absolute left-4 top-8 h-80 w-56 rotate-[-10deg] overflow-hidden rounded-lg border border-[#fffdf5]/20 shadow-[0_30px_80px_rgba(0,0,0,0.35)] sm:left-16">
              <img
                src={musicImages.piano}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>

            <div className={`absolute right-0 top-0 w-full max-w-[380px] rounded-lg p-5 ${brandTheme.glass}`}>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.18em] text-[#a6eee3]">
                <span>AI take review</span>
                <span>02:14</span>
              </div>
              <div className="mt-6 space-y-4">
                {[
                  ["Timing drift", "78%", "bg-[#ff6b6b]"],
                  ["Pitch center", "64%", "bg-[#ffd666]"],
                  ["Dynamics", "91%", "bg-[#2fc5b5]"],
                ].map(([label, width, color]) => (
                  <div key={label}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span>{label}</span>
                      <span className="text-[#fffdf5]/70">{width}</span>
                    </div>
                    <div className="h-2 rounded-lg bg-[#fffdf5]/18">
                      <motion.div
                        className={`h-full rounded-lg ${color}`}
                        initial={{ width: 0 }}
                        animate={{ width }}
                        transition={{ duration: 1, delay: 0.45 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 rounded-lg bg-[#0b1510]/50 p-4 text-sm leading-6 text-[#fffdf5]/85">
                Your left hand rushes after rests. Book a rhythm-first instructor before adding
                speed.
              </p>
            </div>

            <div className="absolute bottom-0 left-0 w-full max-w-[430px] rounded-lg border border-[#ffd666]/35 bg-[#ffd666] p-5 text-[#11140c] shadow-[0_24px_70px_rgba(0,0,0,0.32)] sm:left-20 xl:left-10">
              <p className="text-xs font-black uppercase tracking-[0.2em]">Match found</p>
              <div className="mt-4 flex items-center gap-4">
                <img
                src={musicImages.singer}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <div>
                  <p className="text-xl font-black">Maya Chen</p>
                  <p className="text-sm font-semibold opacity-75">Jazz piano, timing repair</p>
                </div>
              </div>
            </div>
          </motion.section>
        </main>

        <footer className="grid gap-3 border-t border-[#fffdf5]/15 py-5 text-sm text-[#e8f4df]/80 sm:grid-cols-3">
          <p>Record in seconds.</p>
          <p>Practice with a sharper target.</p>
          <p>Meet instructors who fit the gap.</p>
        </footer>
      </div>
    </div>
  );
}
