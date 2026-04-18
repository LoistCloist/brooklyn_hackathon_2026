import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Card } from "@/components/tuneacademy/Card";
import { Pill } from "@/components/tuneacademy/Pill";
import { InstrumentIcon } from "@/components/tuneacademy/InstrumentIcon";
import { challenges } from "@/lib/mockData";
import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/app/analyze")({
  head: () => ({ meta: [{ title: "Analyze — TuneAcademy" }] }),
  component: AnalyzeTab,
});

type ChallengeKey = keyof typeof challenges;

function AnalyzeTab() {
  const [picked, setPicked] = useState<ChallengeKey | null>(null);
  const [recording, setRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<number | null>(null);
  const nav = useNavigate();

  useEffect(() => {
    if (recording) {
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [recording]);

  function toggle() {
    if (recording) {
      setRecording(false);
      setHasRecording(true);
    } else {
      setSeconds(0);
      setHasRecording(false);
      setRecording(true);
    }
  }

  return (
    <AppShell>
      <header className="px-5 pt-8 pb-2">
        <h1 className="text-2xl font-bold tracking-tight">Submit a recording</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {picked ? "Follow the challenge below." : "Choose your instrument."}
        </p>
      </header>

      {!picked && (
        <div className="grid grid-cols-2 gap-3 px-5 pt-4">
          {(Object.keys(challenges) as ChallengeKey[]).map((k) => {
            const c = challenges[k];
            return (
              <button key={k} onClick={() => setPicked(k)} className="text-left">
                <Card className="flex h-44 flex-col justify-between p-4 transition-colors hover:border-foreground/40">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline">
                    <InstrumentIcon instrument={c.instrument} className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Solo {c.instrument}</p>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{c.text}</p>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {picked && (
        <div className="px-5 pt-4">
          <Card className="p-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Challenge</p>
            <p className="mt-2 text-lg font-semibold leading-snug">{challenges[picked].text}</p>
            <button
              onClick={() => { setPicked(null); setHasRecording(false); setRecording(false); }}
              className="mt-3 text-xs text-muted-foreground underline underline-offset-4"
            >
              Change instrument
            </button>
          </Card>

          <div className="mt-10 flex flex-col items-center">
            <Waveform active={recording} />
            <p className="mt-4 text-3xl font-bold tabular-nums">
              {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
            </p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {recording ? "Recording" : hasRecording ? "Stopped" : "Ready"}
            </p>

            <button
              onClick={toggle}
              aria-label={recording ? "Stop" : "Record"}
              className="relative mt-8 flex h-24 w-24 items-center justify-center rounded-full bg-foreground text-background shadow-elevated transition-transform active:scale-95"
            >
              {recording && (
                <motion.div
                  className="absolute inset-0 rounded-full border border-foreground"
                  animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              {recording ? <Square className="h-7 w-7 fill-background" /> : <Mic className="h-8 w-8" />}
            </button>

            {hasRecording && !recording && (
              <Pill className="mt-8 w-full" size="lg" onClick={() => nav({ to: "/app/analyze/result" })}>
                Submit recording
              </Pill>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Waveform({ active }: { active: boolean }) {
  const bars = Array.from({ length: 28 });
  return (
    <div className="flex h-16 items-center gap-[3px]">
      {bars.map((_, i) => (
        <motion.span
          key={i}
          className="block w-[3px] rounded-full bg-foreground"
          animate={
            active
              ? { height: [6, 10 + Math.random() * 36, 6] }
              : { height: 4 }
          }
          transition={{
            duration: 0.7 + (i % 5) * 0.07,
            repeat: active ? Infinity : 0,
            ease: "easeInOut",
          }}
          style={{ height: 4 }}
        />
      ))}
    </div>
  );
}
