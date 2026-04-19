import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { CreateReelDialog } from "@/components/musireels/CreateReelDialog";
import { CommentsDrawer } from "@/components/musireels/CommentsDrawer";
import { RecruitDialog } from "@/components/musireels/RecruitDialog";
import { ReelVideoCard } from "@/components/musireels/ReelVideoCard";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreUserDoc } from "@/hooks/useFirestoreUserDoc";
import { useInstructorInvitationReelIds } from "@/hooks/useInstructorInvitationReelIds";
import { useReels } from "@/hooks/useReels";
import type { Reel } from "@/types";

const musireelsSearchSchema = z.object({ reel: z.string().optional() });

export const Route = createFileRoute("/app/musireels")({
   validateSearch: (raw) => musireelsSearchSchema.parse(raw),
   head: () => ({ meta: [{ title: "Riffs - TuneAcademy" }] }),
   component: Riffs,
});

const RIFFS_VIEWPORT = "calc(100dvh - 4.5rem)";

function Riffs() {
   const { user, userDoc } = useAuth();
   const { user: liveSelf } = useFirestoreUserDoc(user?.uid ?? null);
   const role = liveSelf?.role ?? userDoc?.role;
   const isInstructor = role === "instructor";
   const invitedReelIds = useInstructorInvitationReelIds(user?.uid ?? null);

   const { reels, loading, error } = useReels();
   const [activeId, setActiveId] = useState<string | null>(null);
   const [createOpen, setCreateOpen] = useState(false);
   const [commentsReel, setCommentsReel] = useState<Reel | null>(null);
   const [commentsOpen, setCommentsOpen] = useState(false);
   const [recruitReel, setRecruitReel] = useState<Reel | null>(null);
   const [recruitOpen, setRecruitOpen] = useState(false);
   const [sessionRecruited, setSessionRecruited] = useState<Record<string, boolean>>({});

   const scrollRef = useRef<HTMLDivElement>(null);
   const search = useSearch({ from: "/app/musireels" });
   const nav = useNavigate({ from: "/app/musireels" });

   const uid = user?.uid ?? null;

   const updateActiveFromScroll = useCallback(() => {
      const root = scrollRef.current;
      if (!root || reels.length === 0) return;
      const height = root.clientHeight || 1;
      const index = Math.min(reels.length - 1, Math.max(0, Math.round(root.scrollTop / height)));
      setActiveId(reels[index]?.id ?? null);
   }, [reels]);

   useEffect(() => {
      const root = scrollRef.current;
      if (!root) return;
      updateActiveFromScroll();
      root.addEventListener("scroll", updateActiveFromScroll, { passive: true });
      return () => root.removeEventListener("scroll", updateActiveFromScroll);
   }, [updateActiveFromScroll]);

   useEffect(() => {
      if (!loading && reels.length > 0 && !activeId) {
         setActiveId(reels[0].id);
      }
   }, [loading, reels, activeId]);

   useEffect(() => {
      const target = search.reel;
      if (!target || loading || reels.length === 0) return;
      const index = reels.findIndex((reel) => reel.id === target);
      if (index < 0) return;
      const root = scrollRef.current;
      if (!root) return;
      const height = root.clientHeight;
      requestAnimationFrame(() => {
         root.scrollTo({ top: index * height, behavior: "smooth" });
         setActiveId(target);
         void nav({ search: { reel: undefined }, replace: true });
      });
   }, [search.reel, loading, reels, nav]);

   const onPosted = useCallback((reelId: string) => {
      requestAnimationFrame(() => {
         scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
         setActiveId(reelId);
      });
   }, []);

   return (
      <AppShell padBottom={false}>
         <div
            className="relative mx-auto w-full max-w-md overflow-hidden rounded-xl border border-[#fffdf5]/16 bg-black text-foreground shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
            style={{ height: RIFFS_VIEWPORT }}
         >
            {loading ? (
               <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading riffs...</div>
            ) : error ? (
               <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">{error}</div>
            ) : reels.length === 0 ? (
               <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  <p className="text-base font-medium text-foreground/90">No riffs have been posted yet.</p>
               </div>
            ) : (
               <div ref={scrollRef} className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-y-contain">
                  {reels.map((reel) => (
                     <section key={reel.id} className="snap-start snap-always shrink-0" style={{ height: RIFFS_VIEWPORT }}>
                        <ReelVideoCard
                           reel={reel}
                           isActive={reel.id === activeId}
                           currentUserId={uid}
                           showRecruit={isInstructor}
                           recruitDisabled={Boolean(sessionRecruited[reel.id]) || invitedReelIds.has(reel.id)}
                           onRecruit={() => {
                              setRecruitReel(reel);
                              setRecruitOpen(true);
                           }}
                           onOpenComments={() => {
                              setCommentsReel(reel);
                              setCommentsOpen(true);
                           }}
                        />
                     </section>
                  ))}
               </div>
            )}

            <button
               type="button"
               onClick={() => setCreateOpen(true)}
               className="fixed bottom-[max(0.75rem,env(safe-area-inset-bottom,0px)+0.75rem)] left-1/2 z-50 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg ring-1 ring-black/10 transition hover:bg-white/90"
               aria-label="Create riff"
            >
               <Plus className="h-7 w-7" strokeWidth={2.2} />
            </button>

            <CreateReelDialog
               open={createOpen}
               onOpenChange={setCreateOpen}
               uploaderName={userDoc?.fullName?.trim() || user?.displayName || "User"}
               uploaderAvatarUrl={userDoc?.avatarUrl ?? ""}
               onPosted={onPosted}
            />

            <CommentsDrawer
               reel={commentsReel}
               open={commentsOpen}
               onOpenChange={(open) => {
                  setCommentsOpen(open);
                  if (!open) setCommentsReel(null);
               }}
            />

            {recruitReel && user ? (
               <RecruitDialog
                  open={recruitOpen}
                  onOpenChange={(open) => {
                     setRecruitOpen(open);
                     if (!open) setRecruitReel(null);
                  }}
                  reel={recruitReel}
                  instructorId={user.uid}
                  instructorName={userDoc?.fullName?.trim() || user.displayName || "Instructor"}
                  onSent={() => {
                     setSessionRecruited((prev) => ({ ...prev, [recruitReel.id]: true }));
                  }}
               />
            ) : null}
         </div>
      </AppShell>
   );
}
