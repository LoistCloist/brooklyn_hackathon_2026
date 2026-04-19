import { createFileRoute, Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Avatar } from "@/components/tuneacademy/Avatar";
import { Card } from "@/components/tuneacademy/Card";
import { Chip } from "@/components/tuneacademy/Chip";
import { Pill } from "@/components/tuneacademy/Pill";
import { formatSpecialtyLabel, useInstructorsDirectory } from "@/hooks/useInstructorsDirectory";

export const Route = createFileRoute("/app/instructors/")({
   head: () => ({ meta: [{ title: "Instructors - TuneAcademy" }] }),
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
      const slugs = new Set<string>();
      rows.forEach((row) => row.doc.specialties.forEach((specialty) => slugs.add(specialty.trim().toLowerCase())));
      return [...slugs].filter(Boolean).sort();
   }, [rows]);

   const instrumentChips = useMemo(() => {
      return [{ slug: "all" as const, label: "All" }, ...instrumentSlugs.map((slug) => ({ slug, label: formatSpecialtyLabel(slug) }))];
   }, [instrumentSlugs]);

   const filtered = useMemo(() => {
      if (filterSlug === "all") return rows;
      return rows.filter((row) => row.doc.specialties.some((specialty) => specialty.trim().toLowerCase() === filterSlug));
   }, [rows, filterSlug]);

   return (
      <AppShell>
         <header className="px-5 pb-4 pt-8">
            <h1 className="text-3xl font-black tracking-tight text-[#fffdf5] sm:text-4xl">Find your instructor</h1>
            <p className="mt-2 text-base font-semibold text-[#e8f4df]/62 sm:text-lg">Filter by instrument</p>
         </header>

         {instrumentChips.length > 1 && (
            <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-3">
               {instrumentChips.map((chip) => (
                  <Chip key={chip.slug} active={filterSlug === chip.slug} onClick={() => setFilterSlug(chip.slug)}>
                     {chip.label}
                  </Chip>
               ))}
            </div>
         )}

         <div className="grid grid-cols-2 gap-4 px-5 pt-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {loading ? (
               <Card className="col-span-full border-[#fffdf5]/16 bg-[#fffdf5]/8 p-8 text-center text-base text-[#e8f4df]/62 backdrop-blur">
                  Loading instructors...
               </Card>
            ) : error ? (
               <Card className="col-span-full border-[#fffdf5]/16 bg-[#fffdf5]/8 p-8 text-center text-base text-[#e8f4df]/62 backdrop-blur">
                  {error}
               </Card>
            ) : (
               <>
                  {filtered.map(({ id, doc: instructor }) => (
                     <Link
                        key={id}
                        to="/app/instructors/$id"
                        params={{ id }}
                        className="group block h-full min-h-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#ffd666]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b1510]"
                     >
                        <Card className="flex h-full min-h-70 flex-col overflow-hidden border-[#fffdf5]/16 bg-[#fffdf5]/8 p-0 shadow-[0_20px_60px_rgba(0,0,0,0.18)] backdrop-blur transition-all duration-200 hover:border-[#ffd666]/45 hover:bg-[#fffdf5]/10 hover:shadow-[0_24px_70px_rgba(0,0,0,0.26)] active:scale-[0.99] sm:min-h-[19rem]">
                           <div className="relative aspect-square w-full shrink-0 border-b border-[#fffdf5]/10 bg-[#0b1510]/35">
                              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(255,214,102,0.14),transparent_50%)]" />
                              <div className="absolute inset-0 flex items-center justify-center p-1.5 sm:p-2">
                                 <Avatar
                                    initials={initialsFromName(instructor.fullName)}
                                    src={instructor.avatarUrl}
                                    size={156}
                                    className="!rounded-[2.75rem] ring-2 ring-[#ffd666]/35 ring-offset-2 ring-offset-[#0b1510]/70 transition-transform duration-200 group-hover:scale-[1.02] sm:!rounded-[3.25rem]"
                                 />
                              </div>
                           </div>

                           <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-3 pt-2.5">
                              <div>
                                 <p className="line-clamp-2 text-base font-black leading-snug tracking-tight text-[#fffdf5] sm:text-lg">
                                    {instructor.fullName}
                                 </p>
                                 <p className="mt-1 text-sm font-bold tabular-nums text-[#ffd666] sm:text-base">
                                    {instructor.hourlyRate === 0 ? "Free" : `$${instructor.hourlyRate}/hr`}
                                 </p>
                              </div>

                              <div className="flex flex-wrap items-center gap-1 text-xs text-[#e8f4df]/60 sm:text-sm">
                                 <Star className="h-3.5 w-3.5 shrink-0 fill-[#ffd666] text-[#ffd666] sm:h-4 sm:w-4" aria-hidden />
                                 <span className="font-semibold tabular-nums text-[#fffdf5]">{instructor.rating.toFixed(1)}</span>
                                 <span className="text-[#e8f4df]/40">·</span>
                                 <span className="font-medium">{instructor.reviewCount} reviews</span>
                              </div>

                              <div className="flex flex-wrap gap-1">
                                 {instructor.specialties.map((specialty) => (
                                    <span
                                       key={specialty}
                                       className="rounded-full border border-[#a6eee3]/25 bg-[#a6eee3]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#a6eee3] sm:px-2.5 sm:text-[11px]"
                                    >
                                       {formatSpecialtyLabel(specialty)}
                                    </span>
                                 ))}
                              </div>

                              <div className="flex flex-wrap gap-1">
                                 {(!(instructor as any).sessionType ||
                                    (instructor as any).sessionType === "solo" ||
                                    (instructor as any).sessionType === "both") && (
                                    <span className="rounded-full border border-[#fffdf5]/18 bg-[#fffdf5]/8 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#e8f4df]/80 sm:px-2.5 sm:text-[11px]">
                                       1-on-1
                                    </span>
                                 )}
                                 {((instructor as any).sessionType === "group" || (instructor as any).sessionType === "both") && (
                                    <span className="rounded-full border border-[#ffd666]/25 bg-[#ffd666]/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#ffd666] sm:px-2.5 sm:text-[11px]">
                                       Group
                                    </span>
                                 )}
                              </div>

                              <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-[#e8f4df]/62 sm:text-sm sm:leading-relaxed">
                                 {instructor.bio}
                              </p>
                           </div>
                        </Card>
                     </Link>
                  ))}

                  {filtered.length === 0 && (
                     <Card className="col-span-full border-[#fffdf5]/16 bg-[#fffdf5]/8 p-8 text-center text-base text-[#e8f4df]/62 backdrop-blur">
                        No instructors match. Try clearing filters.
                        <Pill variant="ghost" size="sm" className="mt-4" onClick={() => setFilterSlug("all")}>
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
