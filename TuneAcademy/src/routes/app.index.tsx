import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneFrame } from "@/components/musilearn/PhoneFrame";
import { Avatar } from "@/components/musilearn/Avatar";
import { Card } from "@/components/musilearn/Card";
import { ScoreBar } from "@/components/musilearn/ScoreBar";
import { Pill } from "@/components/musilearn/Pill";
import { InstrumentIcon } from "@/components/musilearn/InstrumentIcon";
import {
  dashboardStats,
  dimensionLabels,
  learnerProfile,
  progressSeries,
  recentReport,
} from "@/lib/mockData";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Home — MusiLearn" }] }),
  component: HomeTab,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function HomeTab() {
  return (
    <PhoneFrame>
      <header className="flex items-center justify-between px-5 pt-8 pb-5">
        <div>
          <p className="text-xs text-muted-foreground">{greeting()},</p>
          <h1 className="text-2xl font-bold tracking-tight">{learnerProfile.fullName}</h1>
        </div>
        <Avatar initials={learnerProfile.avatarInitials} size={44} />
      </header>

      {/* Stat cards row */}
      <div className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2">
        <StatCard label="Lessons taken" value={dashboardStats.lessonsTaken} />
        <StatCard label="Videos posted" value={dashboardStats.videosPosted} />
        <StatCard label="Upcoming" value={dashboardStats.upcomingSession} small />
        <StatCard label="Overall score" value={dashboardStats.overallScore} suffix="/100" />
      </div>

      {/* Progress */}
      <section className="px-5 pt-6">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Your progress</h2>
            <p className="text-xs text-muted-foreground">Guitar · last 6 reports</p>
          </div>
          <p className="text-xs text-muted-foreground">+14</p>
        </div>
        <Card className="p-4">
          <ProgressChart points={progressSeries} />
        </Card>
      </section>

      {/* Recent report */}
      <section className="px-5 pt-6">
        <h2 className="mb-3 text-base font-semibold tracking-tight">Recent report</h2>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-hairline">
                <InstrumentIcon instrument={recentReport.instrument} className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">{recentReport.instrument}</p>
                <p className="text-[11px] text-muted-foreground">{recentReport.date}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums">{recentReport.overall_score}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">/ 100</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {dimensionLabels.map((d) => (
              <ScoreBar key={d.key} label={d.label} value={recentReport.dimension_scores[d.key]} />
            ))}
          </div>

          <div className="mt-5 border-t border-hairline pt-4">
            <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Weaknesses</p>
            <ul className="space-y-1.5 text-sm">
              {recentReport.weaknesses.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>

          <Link to="/app/instructors" search={{ weakness: "Pitch Stability" }}>
            <Pill className="mt-5 w-full" size="md">
              Find instructors for these weaknesses
              <ArrowRight className="h-4 w-4" />
            </Pill>
          </Link>
        </Card>
      </section>
    </PhoneFrame>
  );
}

function StatCard({
  label,
  value,
  suffix,
  small,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  small?: boolean;
}) {
  return (
    <Card className="min-w-[8.5rem] shrink-0 snap-start p-4">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={"mt-3 font-bold leading-none tracking-tight " + (small ? "text-base" : "text-3xl")}>
        {value}
        {suffix && <span className="ml-0.5 text-xs text-muted-foreground">{suffix}</span>}
      </p>
    </Card>
  );
}

function ProgressChart({ points }: { points: number[] }) {
  const w = 280;
  const h = 80;
  const min = Math.min(...points) - 5;
  const max = Math.max(...points) + 5;
  const dx = w / (points.length - 1);
  const y = (v: number) => h - ((v - min) / (max - min)) * h;
  const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${i * dx},${y(p)}`).join(" ");
  const area = `${d} L ${w},${h} L 0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full">
      <defs>
        <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="white" stopOpacity="0.25" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#g)" />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <circle key={i} cx={i * dx} cy={y(p)} r={2.5} fill="currentColor" />
      ))}
    </svg>
  );
}
