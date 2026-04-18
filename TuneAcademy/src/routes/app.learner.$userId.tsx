import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { RecruitDialog } from "@/components/musireels/RecruitDialog";
import { LearnerPosterMessageDialog } from "@/components/tuneacademy/LearnerPosterMessageDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreUserDoc } from "@/hooks/useFirestoreUserDoc";
import { getFirestoreDb } from "@/lib/firebase";
import { firestoreLikeToMillisOrZero } from "@/lib/firestoreTime";
import type { Reel } from "@/types";

const learnerSearchSchema = z.object({
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
});

export const Route = createFileRoute("/app/learner/$userId")({
  validateSearch: (raw) => learnerSearchSchema.parse(raw),
  head: () => ({
    meta: [{ title: "Profile — MusiLearn" }],
  }),
  component: LearnerProfile,
});

function coerceCreatedAtToDate(ts: unknown): Date | null {
  if (ts == null) return null;
  if (ts instanceof Timestamp) {
    const d = ts.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (ts instanceof Date) {
    return Number.isNaN(ts.getTime()) ? null : ts;
  }
  if (typeof ts === "number" && Number.isFinite(ts)) {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts === "string") {
    const d = new Date(ts);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof ts === "object") {
    const o = ts as Record<string, unknown>;
    if (typeof o.toDate === "function") {
      try {
        const d = (o.toDate as (this: typeof o) => Date).call(o);
        return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
      } catch {
        return null;
      }
    }
    const sec =
      typeof o.seconds === "number"
        ? o.seconds
        : typeof o._seconds === "number"
          ? o._seconds
          : null;
    if (sec != null) {
      const ns =
        typeof o.nanoseconds === "number"
          ? o.nanoseconds
          : typeof o._nanoseconds === "number"
            ? o._nanoseconds
            : 0;
      return new Date(sec * 1000 + ns / 1e6);
    }
  }
  return null;
}

function formatAccountCreatedAt(ts: unknown): string {
  const d = coerceCreatedAtToDate(ts);
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type ReportRow = {
  instrument?: string;
  overallScore?: number;
  weaknesses?: string[];
};

function LearnerProfile() {
  const { userId } = Route.useParams();
  const search = Route.useSearch();
  const { user, userDoc } = useAuth();
  const { user: liveSelf } = useFirestoreUserDoc(user?.uid ?? null);
  const { user: profile, loading: profileLoading } = useFirestoreUserDoc(userId);
  const viewerRole = liveSelf?.role ?? userDoc?.role;
  const isInstructor = viewerRole === "instructor";
  const isLearnerViewer = viewerRole === "learner";
  const isOwn = user?.uid === userId;
  const nav = useNavigate();

  const [report, setReport] = useState<ReportRow | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [reportLoading, setReportLoading] = useState(true);
  const [recruitOpen, setRecruitOpen] = useState(false);
  const [inviteReel, setInviteReel] = useState<Reel | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setReportLoading(true);
      try {
        const db = getFirestoreDb();
        const repQuery = query(
          collection(db, "reports"),
          where("userId", "==", userId),
          orderBy("createdAt", "desc"),
          limit(1),
        );
        const repSnap = await getDocs(repQuery);
        if (!cancelled) {
          if (repSnap.empty) setReport(null);
          else setReport(repSnap.docs[0].data() as ReportRow);
        }
      } catch {
        if (!cancelled) setReport(null);
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const db = getFirestoreDb();
    const q = query(collection(db, "reels"), where("uploaderId", "==", userId));
    const unsub = onSnapshot(q, (snap) => {
      const list: Reel[] = snap.docs.map((d) => {
        const data = d.data() as Record<string, unknown>;
        return {
          id: d.id,
          uploaderId: String(data.uploaderId ?? ""),
          uploaderName: String(data.uploaderName ?? ""),
          uploaderAvatarUrl: String(data.uploaderAvatarUrl ?? ""),
          instrument: String(data.instrument ?? ""),
          videoUrl: String(data.videoUrl ?? ""),
          thumbnailUrl: String(data.thumbnailUrl ?? ""),
          caption: String(data.caption ?? ""),
          likesCount: typeof data.likesCount === "number" ? data.likesCount : 0,
          commentsCount: typeof data.commentsCount === "number" ? data.commentsCount : 0,
          likedBy: Array.isArray(data.likedBy) ? (data.likedBy as string[]) : [],
          createdAt: data.createdAt as Reel["createdAt"],
        };
      });
      list.sort(
        (a, b) =>
          firestoreLikeToMillisOrZero(b.createdAt) - firestoreLikeToMillisOrZero(a.createdAt),
      );
      setReels(list);
    });
    return unsub;
  }, [userId]);

  const instruments = useMemo(() => {
    const s = new Set<string>();
    reels.forEach((r) => {
      if (r.instrument) s.add(r.instrument);
    });
    return [...s];
  }, [reels]);

  const displayName = profile?.fullName?.trim() || search.displayName?.trim() || "Profile";
  const posterRole = profile?.role ?? "learner";
  const avatarSrc = profile?.avatarUrl?.trim() || search.avatarUrl?.trim() || "";
  const accountCreatedLabel = formatAccountCreatedAt(profile?.createdAt);
  const weaknesses = (report?.weaknesses ?? []).slice(0, 3);
  const pageLoading = profileLoading || reportLoading;

  const openReel = useCallback(
    (reel: Reel) => {
      void nav({ to: "/app/musireels", search: { reel: reel.id } });
    },
    [nav],
  );

  if (pageLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-28 pt-4">
      <Link to="/app/musireels" className="text-sm text-primary underline-offset-4 hover:underline">
        ← Back to Musireels
      </Link>

      <div className="mt-6 flex flex-col items-center text-center">
        <div className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full bg-muted text-3xl font-bold text-foreground ring-1 ring-border">
          {avatarSrc ? (
            <img src={avatarSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            (displayName[0] ?? "?").toUpperCase()
          )}
        </div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">{displayName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {accountCreatedLabel === "—"
            ? "Account creation date isn’t available."
            : `Account created ${accountCreatedLabel}`}
        </p>
        {instruments.length ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Instruments: {instruments.map((i) => i.charAt(0).toUpperCase() + i.slice(1)).join(", ")}
          </p>
        ) : null}
        {profile?.bio?.trim() ? (
          <div className="mt-5 w-full text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">About</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{profile.bio.trim()}</p>
          </div>
        ) : isInstructor ? (
          <p className="mt-5 w-full text-left text-sm text-muted-foreground">
            This learner has not added a bio yet.
          </p>
        ) : null}
      </div>

      {isOwn ? (
        <Button
          type="button"
          variant="outline"
          className="mt-6 w-full"
          onClick={() => void nav({ to: "/app/profile", search: { editBio: "1" } })}
        >
          Edit profile
        </Button>
      ) : isInstructor ? (
        <Button
          type="button"
          className="mt-6 w-full"
          onClick={() => {
            const r = reels[0];
            if (!r) {
              toast.error("This learner has no reels to attach to an invitation.");
              return;
            }
            setInviteReel(r);
            setRecruitOpen(true);
          }}
        >
          Recruit
        </Button>
      ) : isLearnerViewer && user ? (
        <Button type="button" variant="outline" className="mt-6 w-full" onClick={() => setMessageOpen(true)}>
          Send Message
        </Button>
      ) : null}

      <h2 className="mt-10 text-base font-semibold text-foreground">Latest analysis report</h2>
      {report ? (
        <div className="mt-3 rounded-lg border border-border bg-card p-4 text-left text-sm">
          <p className="font-medium capitalize">{String(report.instrument ?? "Instrument")}</p>
          <p className="mt-2 font-semibold">
            Score: {typeof report.overallScore === "number" ? report.overallScore : "—"} / 100
          </p>
          {weaknesses.length ? (
            <ul className="mt-2 list-inside list-disc text-muted-foreground">
              {weaknesses.map((w, i) => (
                <li key={`${i}-${w.slice(0, 20)}`}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No analysis report on file.</p>
      )}

      <h2 className="mt-10 text-base font-semibold text-foreground">Their reels</h2>
      {reels.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No reels yet.</p>
      ) : (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {reels.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => openReel(r)}
              className="relative h-40 w-24 shrink-0 overflow-hidden rounded-lg bg-muted ring-1 ring-border"
            >
              {r.thumbnailUrl ? (
                <img src={r.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </button>
          ))}
        </div>
      )}

      {inviteReel && user ? (
        <RecruitDialog
          open={recruitOpen}
          onOpenChange={(o) => {
            setRecruitOpen(o);
            if (!o) setInviteReel(null);
          }}
          reel={inviteReel}
          instructorId={user.uid}
          instructorName={userDoc?.fullName?.trim() || user.displayName || "Instructor"}
          onSent={() => {
            setRecruitOpen(false);
            setInviteReel(null);
          }}
        />
      ) : null}

      {user && isLearnerViewer && !isOwn ? (
        <LearnerPosterMessageDialog
          open={messageOpen}
          onOpenChange={setMessageOpen}
          learnerId={user.uid}
          learnerName={userDoc?.fullName?.trim() || user.displayName || "Learner"}
          posterId={userId}
          posterName={displayName}
          posterRole={posterRole}
        />
      ) : null}
    </div>
  );
}
