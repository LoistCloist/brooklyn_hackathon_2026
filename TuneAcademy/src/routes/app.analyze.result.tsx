import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Card } from "@/components/tuneacademy/Card";
import { Pill } from "@/components/tuneacademy/Pill";
import { ScoreBar } from "@/components/tuneacademy/ScoreBar";
import { dimensionLabels } from "@/lib/mockData";
import { ArrowLeft, ArrowRight, Mic, MicOff, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

export const Route = createFileRoute("/app/analyze/result")({
  validateSearch: z.object({ reportId: z.string().optional() }),
  head: () => ({ meta: [{ title: "Your analysis – TuneAcademy" }] }),
  component: ResultPage,
});

function useCount(target: number, durationMs = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return n;
}

type ReportData = {
  instrument: string;
  overallScore: number;
  dimensionScores: Record<string, number>;
  weaknesses: string[];
  status: string;
};

function ResultPage() {
  const nav = useNavigate();
  const { reportId } = Route.useSearch();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reportId) { setLoading(false); return; }
    const db = getFirestoreDb();
    const unsub = onSnapshot(doc(db, "reports", reportId), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.status === "done" || d.status === "error") {
        setReport({
          instrument: d.instrument ?? "Unknown",
          overallScore: d.overallScore ?? 0,
          dimensionScores: d.dimensionScores ?? {},
          weaknesses: d.weaknesses ?? [],
          status: d.status,
        });
        setLoading(false);
      }
    });
    return unsub;
  }, [reportId]);

  const score = useCount(report?.overallScore ?? 0);

  const conversation = useConversation({
    onConnect: () => console.log("TuneCoach connected"),
    onDisconnect: () => console.log("TuneCoach disconnected"),
    onError: (error) => console.error("TuneCoach error:", error),
  });

  const isConnected = conversation.status === "connected";
  const isConnecting = conversation.status === "connecting";

  const handleToggleCoach = async () => {
    if (isConnected) {
      await conversation.endSession();
    } else {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      await conversation.startSession({
        agentId: "agent_3001kph9exayf6etsbvvqm759djj",
      });
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Analyzing your recording…</p>
        </div>
      </AppShell>
    );
  }

  if (!report || report.status === "error") {
    return (
      <AppShell>
        <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-lg font-semibold">Analysis unavailable</p>
          <p className="text-sm text-muted-foreground">Something went wrong. Try recording again.</p>
          <Pill size="lg" onClick={() => nav({ to: "/app/analyze" })}>Try again</Pill>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="flex items-center justify-between px-5 pt-6">
        <button
          onClick={() => nav({ to: "/app/analyze" })}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Analysis</p>
        <div className="w-10" />
      </header>

      <motion.div
        className="px-5 pt-6 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Overall score</p>
        <p className="mt-2 text-[96px] font-extrabold leading-none tracking-tighter tabular-nums">
          {score}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">/ 100 · {report.instrument}</p>
      </motion.div>

      <section className="px-5 pt-8">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">By dimension</h2>
        <Card className="space-y-4 p-5">
          {dimensionLabels.map((d) => (
            <ScoreBar
              key={d.key}
              label={d.label}
              value={report.dimensionScores[d.key] ?? 0}
              animate
            />
          ))}
        </Card>
      </section>

      {report.weaknesses.length > 0 && (
        <section className="px-5 pt-6">
          <h2 className="mb-3 text-sm font-semibold tracking-tight">Weaknesses</h2>
          <Card className="p-5">
            <ul className="space-y-2.5 text-sm">
              {report.weaknesses.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <div className="px-5 pt-6">
        <Card className="p-5 text-center">
          <p className="mb-1 text-sm font-semibold">Talk to TuneCoach</p>
          <p className="mb-4 text-xs text-muted-foreground">
            {isConnected
              ? conversation.isSpeaking
                ? "TuneCoach is speaking..."
                : "Listening..."
              : "Ask your AI coach about your results"}
          </p>
          <button
            onClick={handleToggleCoach}
            disabled={isConnecting}
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full transition-all ${
              isConnected ? "bg-red-500 text-white" : "bg-foreground text-background"
            }`}
          >
            {isConnecting ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : isConnected ? (
              <MicOff className="h-6 w-6" />
            ) : (
              <Mic className="h-6 w-6" />
            )}
          </button>
          {isConnected && (
            <p className="mt-3 text-xs text-red-500">Tap to end session</p>
          )}
        </Card>
      </div>

      <div className="px-5 pt-4 pb-10">
        <Link to="/app/instructors">
          <Pill size="lg" className="w-full">
            See suggested instructors
            <ArrowRight className="h-4 w-4" />
          </Pill>
        </Link>
      </div>
    </AppShell>
  );
}
