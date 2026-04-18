import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Card } from "@/components/tuneacademy/Card";
import { Chip } from "@/components/tuneacademy/Chip";
import { Avatar } from "@/components/tuneacademy/Avatar";
import { Pill } from "@/components/tuneacademy/Pill";
import { instructors, recentReport, dimensionLabels } from "@/lib/mockData";
import { Star } from "lucide-react";
import { useMemo, useState } from "react";

type Search = { weakness?: string };

export const Route = createFileRoute("/app/instructors")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    weakness: typeof s.weakness === "string" ? s.weakness : undefined,
  }),
  head: () => ({ meta: [{ title: "Instructors — TuneAcademy" }] }),
  component: InstructorsTab,
});

const INSTRUMENT_CHIPS = ["All", "Voice", "Guitar", "Piano", "Saxophone", "Violin", "Drums"] as const;

function InstructorsTab() {
  const { weakness } = Route.useSearch();
  const [filter, setFilter] = useState<string>("All");
  const [activeWeakness, setActiveWeakness] = useState<string | undefined>(weakness);

  const weaknessChips = useMemo(
    () =>
      dimensionLabels
        .filter((d) => recentReport.dimension_scores[d.key] < 75)
        .map((d) => d.label),
    [],
  );

  const filtered = instructors.filter((i) => {
    const instrumentMatch = filter === "All" || i.specialties.includes(filter as never);
    const weaknessMatch = !activeWeakness || i.addresses.includes(activeWeakness);
    return instrumentMatch && weaknessMatch;
  });

  return (
    <AppShell>
      <header className="px-5 pt-8 pb-4">
        <h1 className="text-2xl font-bold tracking-tight">Find your instructor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {activeWeakness ? `Matched for "${activeWeakness}"` : "Filter by instrument or weakness"}
        </p>
      </header>

      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-3">
        {INSTRUMENT_CHIPS.map((c) => (
          <Chip key={c} active={filter === c} onClick={() => setFilter(c)}>
            {c}
          </Chip>
        ))}
      </div>

      {weaknessChips.length > 0 && (
        <div className="no-scrollbar -mx-5 mb-2 flex gap-2 overflow-x-auto px-5">
          {weaknessChips.map((w) => (
            <Chip
              key={w}
              weakness={activeWeakness !== w}
              active={activeWeakness === w}
              onClick={() => setActiveWeakness((cur) => (cur === w ? undefined : w))}
            >
              {w}
            </Chip>
          ))}
        </div>
      )}

      <div className="space-y-3 px-5 pt-3">
        {filtered.map((i) => (
          <Link key={i.id} to="/app/instructors/$id" params={{ id: i.id }}>
            <Card className="flex gap-4 p-4 transition-colors hover:border-foreground/40">
              <Avatar initials={i.avatar} size={56} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-semibold">{i.name}</p>
                  <p className="shrink-0 text-xs font-medium tabular-nums">
                    {i.hourlyRate === 0 ? "Free" : `$${i.hourlyRate}/hr`}
                  </p>
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-foreground text-foreground" />
                  <span className="tabular-nums text-foreground">{i.rating.toFixed(1)}</span>
                  <span>· {i.reviewsCount} reviews</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {i.specialties.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-hairline px-2 py-0.5 text-[10px] uppercase tracking-widest text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{i.bio}</p>
              </div>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No instructors match. Try clearing filters.
            <Pill variant="ghost" size="sm" className="mt-4" onClick={() => { setFilter("All"); setActiveWeakness(undefined); }}>
              Reset
            </Pill>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
