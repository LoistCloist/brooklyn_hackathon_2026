import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { MyStudentsPanel } from "@/components/tuneacademy/MyStudentsPanel";
import { PendingSchedulingRequestsPanel } from "@/components/tuneacademy/PendingSchedulingRequestsPanel";
import { StudentsDirectory } from "@/components/tuneacademy/StudentsDirectory";
import { useAuth } from "@/contexts/AuthContext";
import { brandTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Bell, Compass, Users } from "lucide-react";

const studentsSearchSchema = z.object({ tab: z.string().optional() });

export type StudentsTabKey = "explore" | "pending" | "mine";

function normalizeStudentsTab(tab: string | undefined): StudentsTabKey {
   if (tab === "pending") return "pending";
   if (tab === "mine") return "mine";
   if (tab === "roster" || tab === "explore" || tab === undefined) return "explore";
   return "explore";
}

export const Route = createFileRoute("/app/students")({
   validateSearch: (raw) => studentsSearchSchema.parse(raw ?? {}),
   head: () => ({ meta: [{ title: "Students — TuneAcademy" }] }),
   component: StudentsTab,
});

function StudentsTab() {
   const { userDoc, loading } = useAuth();
   const search = Route.useSearch();
   const tab = normalizeStudentsTab(search.tab);

   if (loading) {
      return (
         <AppShell>
            <div className="flex min-h-[45vh] items-center justify-center text-sm font-semibold text-[#e8f4df]/55">Loading…</div>
         </AppShell>
      );
   }

   if (userDoc?.role !== "instructor") {
      return <Navigate to="/app" replace />;
   }

   const title = tab === "pending" ? "Pending requests" : tab === "mine" ? "My students" : "Explore students";

   return (
      <AppShell>
         <div className="mb-8 pt-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
               <p className={`text-xs font-black uppercase tracking-[0.22em] ${brandTheme.gold}`}>Instructor workspace</p>
               <h1 className="mt-2 text-2xl font-black tracking-tight text-[#fffdf5] md:text-3xl">{title}</h1>
            </div>
            <div className="flex w-full max-w-136 flex-wrap gap-1 rounded-2xl border border-[#fffdf5]/14 bg-[#0b1510]/55 p-1 shadow-inner lg:w-136">
               <Link
                  to="/app/students"
                  search={{ tab: "explore" }}
                  className={cn(
                     "inline-flex min-w-0 basis-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.08em] transition sm:gap-2 sm:text-[10px] sm:tracking-widest",
                     tab === "explore" ? "bg-[#ffd666] text-[#11140c] shadow-sm" : "text-[#e8f4df]/55 hover:text-[#fffdf5]",
                  )}
               >
                  <Compass className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Explore</span>
               </Link>
               <Link
                  to="/app/students"
                  search={{ tab: "mine" }}
                  className={cn(
                     "inline-flex min-w-0 basis-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.08em] transition sm:gap-2 sm:text-[10px] sm:tracking-widest",
                     tab === "mine" ? "bg-[#ffd666] text-[#11140c] shadow-sm" : "text-[#e8f4df]/55 hover:text-[#fffdf5]",
                  )}
               >
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">My students</span>
               </Link>
               <Link
                  to="/app/students"
                  search={{ tab: "pending" }}
                  className={cn(
                     "inline-flex min-w-0 basis-0 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.08em] transition sm:gap-2 sm:text-[10px] sm:tracking-widest",
                     tab === "pending" ? "bg-[#ffd666] text-[#11140c] shadow-sm" : "text-[#e8f4df]/55 hover:text-[#fffdf5]",
                  )}
               >
                  <Bell className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Pending</span>
               </Link>
            </div>
         </div>

         {tab === "pending" ? <PendingSchedulingRequestsPanel /> : tab === "mine" ? <MyStudentsPanel /> : <StudentsDirectory />}
      </AppShell>
   );
}
