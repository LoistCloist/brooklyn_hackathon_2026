import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Card } from "@/components/tuneacademy/Card";
import { Chip } from "@/components/tuneacademy/Chip";
import { Avatar } from "@/components/tuneacademy/Avatar";
import { Pill } from "@/components/tuneacademy/Pill";
import { formatSpecialtyLabel, useInstructorsDirectory } from "@/hooks/useInstructorsDirectory";
import { Star } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/app/instructors/")({
  head: () => ({ meta: [{ title: "Instructors — TuneAcademy" }] }),
  component: InstructorsTab,
});

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] || "?").toUpperCase();
}

function InstructorsTab() {
  const { rows, loading, error } = useInstructorsDirectory();
  const [filterSlug, setFilterSlug] = useState<string>("all");

  const instrumentSlugs = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => r.doc.specialties.forEach((sp) => s.add(sp.trim().toLowerCase())));
    return [...s].filter(Boolean).sort();
  }, [rows]);

  const instrumentChips = useMemo(() => {
    return [
      { slug: "all" as const, label: "All" },
      ...instrumentSlugs.map((slug) => ({ slug, label: formatSpecialtyLabel(slug) })),
    ];
  }, [instrumentSlugs]);

  const filtered = useMemo(() => {
    if (filterSlug === "all") return rows;
    return rows.filter((r) =>
      r.doc.specialties.some((sp) => sp.trim().toLowerCase() === filterSlug),
    );
  }, [rows, filterSlug]);

  return (
    <AppShell>
      <header className="px-5 pt-8 pb-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Find your instructor</h1>
        <p className="mt-2 text-base text-muted-foreground sm:text-lg">Filter by instrument</p>
      </header>

      {instrumentChips.length > 1 && (
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-3">
          {instrumentChips.map((c) => (
            <Chip key={c.slug} active={filterSlug === c.slug} onClick={() => setFilterSlug(c.slug)}>
              {c.label}
            </Chip>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 px-5 pt-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {loading ? (
          <Card className="col-span-full p-8 text-center text-base text-muted-foreground">
            Loading instructors…
          </Card>
        ) : error ? (
          <Card className="col-span-full p-8 text-center text-base text-muted-foreground">
            {error}
          </Card>
        ) : (
          <>
            {filtered.map(({ id, doc: i }) => (
              <Link
                key={id}
                to="/app/instructors/$id"
                params={{ id }}
                className="group block h-full min-h-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card className="flex h-full min-h-70 flex-col overflow-hidden p-0 transition-all duration-200 hover:border-foreground/50 hover:shadow-lg active:scale-[0.99] sm:min-h-[19rem]">
                  <div className="relative aspect-square w-full shrink-0 bg-gradient-to-b from-muted/40 to-muted/10">
                    <div className="absolute inset-0 flex items-center justify-center p-1.5 sm:p-2">
                      <Avatar
                        initials={initialsFromName(i.fullName)}
                        src={i.avatarUrl}
                        size={156}
                        className="!rounded-[2.75rem] ring-2 ring-background/80 ring-offset-2 ring-offset-transparent transition-transform duration-200 group-hover:scale-[1.02] sm:!rounded-[3.25rem]"
                      />
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-3 pt-2.5">
                    <div>
                      <p className="line-clamp-2 text-base font-bold leading-snug tracking-tight sm:text-lg">
                        {i.fullName}
                      </p>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-foreground sm:text-base">
                        {i.hourlyRate === 0 ? "Free" : `$${i.hourlyRate}/hr`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground sm:text-sm">
                      <Star
                        className="h-3.5 w-3.5 shrink-0 fill-foreground text-foreground sm:h-4 sm:w-4"
                        aria-hidden
                      />
                      <span className="font-semibold tabular-nums text-foreground">
                        {i.rating.toFixed(1)}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-medium">{i.reviewCount} reviews</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {i.specialties.map((s) => (
                        <span
                          key={s}
                          className="rounded-full border border-hairline bg-muted/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-2.5 sm:text-[11px]"
                        >
                          {formatSpecialtyLabel(s)}
                        </span>
                      ))}
                    </div>
                    <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground sm:text-sm sm:leading-relaxed">
                      {i.bio}
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
            {filtered.length === 0 && (
              <Card className="col-span-full p-8 text-center text-base text-muted-foreground">
                No instructors match. Try clearing filters.
                <Pill
                  variant="ghost"
                  size="sm"
                  className="mt-4"
                  onClick={() => {
                    setFilterSlug("all");
                  }}
                >
                  Reset
                </Pill>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
