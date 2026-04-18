import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Card } from "@/components/tuneacademy/Card";
import { Pill } from "@/components/tuneacademy/Pill";
import { ScoreBar } from "@/components/tuneacademy/ScoreBar";
import { dimensionLabels, recentReport } from "@/lib/mockData";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/app/analyze/result")({
  head: () => ({ meta: [{ title: "Your analysis — TuneAcademy" }] }),
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

function ResultPage() {
  const nav = useNavigate();
  const score = useCount(recentReport.overall_score);

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
        <p className="mt-2 text-[96px] font-extrabold leading-none tracking-tighter tabular-nums">{score}</p>
        <p className="mt-1 text-xs text-muted-foreground">/ 100 · {recentReport.instrument}</p>
      </motion.div>

      <section className="px-5 pt-8">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">By dimension</h2>
        <Card className="space-y-4 p-5">
          {dimensionLabels.map((d) => (
            <ScoreBar key={d.key} label={d.label} value={recentReport.dimension_scores[d.key]} animate />
          ))}
        </Card>
      </section>

      <section className="px-5 pt-6">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Weaknesses</h2>
        <Card className="p-5">
          <ul className="space-y-2.5 text-sm">
            {recentReport.weaknesses.map((w, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground" />
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <div className="px-5 pt-6">
        <Link to="/app/instructors" search={{ weakness: "Pitch Stability" }}>
          <Pill size="lg" className="w-full">
            See suggested instructors
            <ArrowRight className="h-4 w-4" />
          </Pill>
        </Link>
      </div>
    </AppShell>
  );
}
