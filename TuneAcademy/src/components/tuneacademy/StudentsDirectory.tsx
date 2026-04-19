import { Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpRight, Film, GraduationCap, MessageSquare, Radio, Search, Sparkles, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { InstructorLearnerMessageDialog } from "@/components/tuneacademy/InstructorLearnerMessageDialog";
import { Pill } from "@/components/tuneacademy/Pill";
import { useAuth } from "@/contexts/AuthContext";
import { useLearnersDirectory, type LearnerDirectoryRow } from "@/hooks/useLearnersDirectory";
import { firestoreLikeToMillis } from "@/lib/firestoreTime";
import { brandTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type Segment = "all" | "on_stage" | "backstage";
type SortKey = "name" | "reels";

function labelInstrument(slug: string): string {
   if (!slug) return "";
   return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function isNewMember(createdAt: unknown): boolean {
   const ms = firestoreLikeToMillis(createdAt);
   if (ms == null) return false;
   const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
   return ms >= cutoff;
}

function inviteBadge(status: LearnerDirectoryRow["inviteStatus"]): { label: string; className: string } | null {
   if (status === "none") return null;
   if (status === "pending") return { label: "Invite sent", className: "border-[#ffd666]/50 bg-[#ffd666]/15 text-[#ffd666]" };
   if (status === "accepted") return { label: "Connected", className: "border-[#2fc5b5]/45 bg-[#2fc5b5]/12 text-[#a6eee3]" };
   return { label: "Declined", className: "border-[#fffdf5]/12 text-[#e8f4df]/45" };
}

export function StudentsDirectory() {
   const { user, userDoc } = useAuth();
   const { rows, loading, error } = useLearnersDirectory(user?.uid ?? null);

   const [q, setQ] = useState("");
   const [segment, setSegment] = useState<Segment>("all");
   const [instrument, setInstrument] = useState<string>("all");
   const [sort, setSort] = useState<SortKey>("name");
   const [messageOpen, setMessageOpen] = useState(false);
   const [messageTarget, setMessageTarget] = useState<{ id: string; name: string } | null>(null);

   const instrumentOptions = useMemo(() => {
      const s = new Set<string>();
      rows.forEach((r) => r.instruments.forEach((i) => s.add(i)));
      return ["all", ...[...s].sort()];
   }, [rows]);

   const filtered = useMemo(() => {
      const needle = q.trim().toLowerCase();
      let list = rows.filter((r) => {
         if (segment === "on_stage" && r.reelCount === 0) return false;
         if (segment === "backstage" && r.reelCount > 0) return false;
         if (instrument !== "all" && !r.instruments.includes(instrument)) return false;
         if (!needle) return true;
         const name = (r.doc.fullName || "").toLowerCase();
         const instruments = r.instruments.join(" ").toLowerCase();
         return name.includes(needle) || instruments.includes(needle);
      });
      if (sort === "reels") {
         list = [...list].sort((a, b) => b.reelCount - a.reelCount || (a.doc.fullName || "").localeCompare(b.doc.fullName || ""));
      }
      return list;
   }, [rows, q, segment, instrument, sort]);

   const stats = useMemo(() => {
      const onStage = rows.filter((r) => r.reelCount > 0).length;
      return { total: rows.length, onStage };
   }, [rows]);

   return (
      <>
         <header className="relative overflow-hidden rounded-2xl border border-[#fffdf5]/18 bg-[#fffdf5]/7 p-8 shadow-[0_28px_100px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#ffd666]/25 blur-3xl" />
            <div className="pointer-events-none absolute -left-10 bottom-0 h-48 w-48 rounded-full bg-[#2fc5b5]/20 blur-3xl" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
               <div>
                  <p className={`inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] ${brandTheme.gold}`}>
                     <GraduationCap className="h-4 w-4" />
                     Directory
                  </p>
                  <h1 className="mt-3 text-4xl font-black tracking-tight text-[#fffdf5] md:text-5xl">Explore students</h1>
                  <p className="mt-3 max-w-xl text-base leading-relaxed text-[#e8f4df]/72">
                     Browse every learner on TuneAcademy, filter by vibe and instrument, open a profile to see their reels, or send a
                     message to start a conversation.
                  </p>
               </div>
               <div className="flex flex-wrap gap-3">
                  <div className="rounded-xl border border-[#fffdf5]/14 bg-[#0b1510]/55 px-5 py-4">
                     <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e8f4df]/50">Pool</p>
                     <p className="mt-1 flex items-center gap-2 text-3xl font-black tabular-nums text-[#fffdf5]">
                        <Users className="h-7 w-7 text-[#ffd666]" />
                        {stats.total}
                     </p>
                  </div>
                  <div className="rounded-xl border border-[#2fc5b5]/25 bg-[#0b1510]/55 px-5 py-4">
                     <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#e8f4df]/50">On Musireels</p>
                     <p className="mt-1 flex items-center gap-2 text-3xl font-black tabular-nums text-[#a6eee3]">
                        <Film className="h-7 w-7 text-[#2fc5b5]" />
                        {stats.onStage}
                     </p>
                  </div>
               </div>
            </div>
         </header>

         <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-md flex-1">
               <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#e8f4df]/40" />
               <input
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name or instrument..."
                  className="h-12 w-full rounded-xl border border-[#fffdf5]/15 bg-[#0b1510]/70 pl-11 pr-4 text-sm font-medium text-[#fffdf5] placeholder:text-[#e8f4df]/35 focus:border-[#ffd666]/50 focus:outline-none focus:ring-2 focus:ring-[#ffd666]/25"
               />
            </div>
            <div className="flex flex-wrap items-center gap-2">
               <span className="mr-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#e8f4df]/40">Sort</span>
               {(["name", "reels"] as const).map((k) => (
                  <button
                     key={k}
                     type="button"
                     onClick={() => setSort(k)}
                     className={cn(
                        "rounded-full border px-4 py-2 text-xs font-black uppercase tracking-[0.12em] transition-colors",
                        sort === k
                           ? "border-[#ffd666]/55 bg-[#ffd666]/18 text-[#ffd666]"
                           : "border-[#fffdf5]/14 text-[#e8f4df]/55 hover:border-[#fffdf5]/28 hover:text-[#fffdf5]",
                     )}
                  >
                     {k === "name" ? "A–Z" : "Most reels"}
                  </button>
               ))}
            </div>
         </div>

         <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1">
            {(
               [
                  { id: "all" as const, label: "Everyone", icon: Users },
                  { id: "on_stage" as const, label: "On stage", icon: Radio },
                  { id: "backstage" as const, label: "Backstage", icon: Sparkles },
               ] as const
            ).map((seg) => {
               const Icon = seg.icon;
               const active = segment === seg.id;
               return (
                  <button
                     key={seg.id}
                     type="button"
                     onClick={() => setSegment(seg.id)}
                     className={cn(
                        "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-black uppercase tracking-[0.14em] transition-colors",
                        active
                           ? "border-[#ffd666]/55 bg-[#ffd666]/18 text-[#ffd666]"
                           : "border-[#fffdf5]/14 text-[#e8f4df]/55 hover:border-[#fffdf5]/28 hover:text-[#fffdf5]",
                     )}
                  >
                     <Icon className="h-3.5 w-3.5" strokeWidth={active ? 2.4 : 1.8} />
                     {seg.label}
                  </button>
               );
            })}
         </div>

         {instrumentOptions.length > 1 && (
            <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto pb-2">
               {instrumentOptions.map((ins) => (
                  <button
                     key={ins}
                     type="button"
                     onClick={() => setInstrument(ins)}
                     className={cn(
                        "h-8 shrink-0 rounded-full border px-3 text-xs font-bold capitalize tracking-tight transition-colors",
                        instrument === ins
                           ? "border-[#2fc5b5]/50 bg-[#2fc5b5]/15 text-[#a6eee3]"
                           : "border-[#fffdf5]/14 text-[#e8f4df]/55 hover:border-[#fffdf5]/28 hover:text-[#fffdf5]",
                     )}
                  >
                     {ins === "all" ? "All instruments" : labelInstrument(ins)}
                  </button>
               ))}
            </div>
         )}

         {loading ? (
            <div className="mt-16 flex flex-col items-center justify-center gap-4 text-[#e8f4df]/55">
               <motion.div
                  className="h-12 w-12 rounded-full border-2 border-[#ffd666]/30 border-t-[#ffd666]"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
               />
               <p className="text-sm font-semibold">Syncing roster…</p>
            </div>
         ) : error ? (
            <div className="mt-12 rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">{error}</div>
         ) : (
            <motion.ul
               className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
               initial="hidden"
               animate="show"
               variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
            >
               <AnimatePresence mode="popLayout">
                  {filtered.map((row) => {
                     const statusBadge = inviteBadge(row.inviteStatus);
                     return (
                        <motion.li
                           key={row.id}
                           layout
                           variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
                           transition={{ type: "spring", stiffness: 380, damping: 28 }}
                           className="group relative overflow-hidden rounded-2xl border border-[#fffdf5]/12 bg-gradient-to-br from-[#fffdf5]/9 to-[#0b1510]/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.25)] transition-colors hover:border-[#ffd666]/35"
                        >
                           <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_90%_0%,rgba(255,214,102,0.12),transparent_45%)] opacity-0 transition-opacity group-hover:opacity-100" />
                           <div className="relative flex gap-4">
                              <div className="relative h-16 w-16 shrink-0">
                                 <div className="absolute inset-0 rounded-2xl bg-[conic-gradient(from_120deg,#ffd666,#2fc5b5,#ffd666)] opacity-60 blur-md transition group-hover:opacity-90" />
                                 <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border border-[#fffdf5]/20 bg-[#0b1510] text-lg font-black text-[#fffdf5]">
                                    {row.doc.avatarUrl?.trim() ? (
                                       <img src={row.doc.avatarUrl} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                       (row.doc.fullName?.[0] || "?").toUpperCase()
                                    )}
                                 </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                 <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                       <p className="truncate text-base font-black text-[#fffdf5]">
                                          {row.doc.fullName?.trim() || "Learner"}
                                       </p>
                                       <p className="truncate text-xs font-medium text-[#e8f4df]/50">TuneAcademy profile</p>
                                    </div>
                                    {isNewMember(row.doc.createdAt) ? (
                                       <span className="shrink-0 rounded-full bg-[#ff6b6b]/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#ff9b9b]">
                                          New
                                       </span>
                                    ) : null}
                                 </div>
                                 <div className="mt-3 flex flex-wrap gap-1.5">
                                    {row.reelCount > 0 ? (
                                       <span className="rounded-full border border-[#2fc5b5]/35 bg-[#2fc5b5]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#a6eee3]">
                                          {row.reelCount} reel{row.reelCount === 1 ? "" : "s"}
                                       </span>
                                    ) : (
                                       <span className="rounded-full border border-[#fffdf5]/12 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#e8f4df]/45">
                                          No reels yet
                                       </span>
                                    )}
                                    {statusBadge ? (
                                       <span
                                          className={cn(
                                             "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                             statusBadge.className,
                                          )}
                                       >
                                          {statusBadge.label}
                                       </span>
                                    ) : null}
                                 </div>
                                 {row.instruments.length > 0 ? (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                       {row.instruments.slice(0, 4).map((ins) => (
                                          <span
                                             key={ins}
                                             className="rounded-md border border-[#fffdf5]/10 bg-[#0b1510]/50 px-2 py-0.5 text-[10px] font-semibold capitalize text-[#e8f4df]/70"
                                          >
                                             {labelInstrument(ins)}
                                          </span>
                                       ))}
                                       {row.instruments.length > 4 ? (
                                          <span className="text-[10px] font-bold text-[#e8f4df]/40">+{row.instruments.length - 4}</span>
                                       ) : null}
                                    </div>
                                 ) : null}
                              </div>
                           </div>

                           <div className="relative mt-5 flex gap-2">
                              <Link
                                 to="/app/learner/$userId"
                                 params={{ userId: row.id }}
                                 search={{ displayName: row.doc.fullName?.trim(), avatarUrl: row.doc.avatarUrl?.trim() }}
                                 className={cn(
                                    "inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#fffdf5]/18 py-3 text-xs font-black uppercase tracking-[0.12em] text-[#fffdf5] transition hover:border-[#fffdf5]/35 hover:bg-[#fffdf5]/8",
                                 )}
                              >
                                 Profile
                                 <ArrowUpRight className="h-3.5 w-3.5" />
                              </Link>
                              <button
                                 type="button"
                                 disabled={!user}
                                 onClick={() => {
                                    setMessageTarget({ id: row.id, name: row.doc.fullName?.trim() || "Learner" });
                                    setMessageOpen(true);
                                 }}
                                 className={cn(
                                    "inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-xs font-black uppercase tracking-[0.12em] transition",
                                    "bg-[#ffd666] text-[#11140c] hover:bg-[#ffe08a] disabled:cursor-not-allowed disabled:opacity-35",
                                 )}
                              >
                                 <MessageSquare className="h-3.5 w-3.5" />
                                 Message
                              </button>
                           </div>
                        </motion.li>
                     );
                  })}
               </AnimatePresence>
            </motion.ul>
         )}

         {!loading && !error && filtered.length === 0 ? (
            <div className="mt-12 rounded-2xl border border-[#fffdf5]/12 bg-[#fffdf5]/5 p-10 text-center">
               <p className="text-lg font-black text-[#fffdf5]">No matches in the lights</p>
               <p className="mt-2 text-sm text-[#e8f4df]/55">Loosen filters or clear search to widen the house.</p>
               <Pill
                  variant="ghost"
                  size="sm"
                  className="mt-6 border-[#fffdf5]/20 text-[#fffdf5]"
                  onClick={() => {
                     setQ("");
                     setSegment("all");
                     setInstrument("all");
                     setSort("name");
                  }}
               >
                  Reset filters
               </Pill>
            </div>
         ) : null}

         {messageTarget && user ? (
            <InstructorLearnerMessageDialog
               open={messageOpen}
               onOpenChange={(o) => {
                  setMessageOpen(o);
                  if (!o) setMessageTarget(null);
               }}
               learnerId={messageTarget.id}
               learnerName={messageTarget.name}
               instructorId={user.uid}
               instructorName={userDoc?.fullName?.trim() || user.displayName || "Instructor"}
               onSent={() => {
                  setMessageOpen(false);
                  setMessageTarget(null);
               }}
            />
         ) : null}
      </>
   );
}
