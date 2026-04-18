import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { RecruitDialog } from "@/components/musireels/RecruitDialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useFirestoreUserDoc } from "@/hooks/useFirestoreUserDoc";
import { getFirestoreDb } from "@/lib/firebase";
import type { UserFirestoreDoc } from "@/lib/musilearnFirestore";
import type { Reel } from "@/types";

export const Route = createFileRoute("/app/learner/$userId")({
  head: ({ params }) => ({
    meta: [{ title: `Learner — ${params.userId.slice(0, 8)}… — MusiLearn` }],
  }),
  component: LearnerProfile,
});

function formatJoined(ts: unknown): string {
  if (ts && typeof ts === "object" && "toDate" in ts && typeof (ts as { toDate: () => Date }).toDate === "function") {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  return "—";
}

type ReportRow = {
  instrument?: string;
  overallScore?: number;
  weaknesses?: string[];
};

function LearnerProfile() {
  const { userId } = Route.useParams();
  const { user, userDoc } = useAuth();
  const { user: liveSelf } = useFirestoreUserDoc(user?.uid ?? null);
  const viewerRole = liveSelf?.role ?? userDoc?.role;
  const isInstructor = viewerRole === "instructor";
  const isOwn = user?.uid === userId;
  const nav = useNavigate();

  const [profile, setProfile] = useState<UserFirestoreDoc | null>(null);
  const [report, setReport] = useState<ReportRow | null>(null);
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [recruitOpen, setRecruitOpen] = useState(false);
  const [inviteReel, setInviteReel] = useState<Reel | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const db = getFirestoreDb();
        const learnerSnap = await getDoc(doc(db, "users", userId));
        if (!cancelled) {
          setProfile(learnerSnap.exists() ? (learnerSnap.data() as UserFirestoreDoc) : null);
        }

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
        if (!cancelled) {
          setProfile(null);
          setReport(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
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
          (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0),
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

  const displayName = profile?.fullName?.trim() || "Learner";
  const weaknesses = (report?.weaknesses ?? []).slice(0, 3);

  const openReel = useCallback(
    (reel: Reel) => {
      void nav({ to: "/app/musireels", search: { reel: reel.id } });
    },
    [nav],
  );

  if (loading) {
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
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            (displayName[0] ?? "?").toUpperCase()
          )}
        </div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">{displayName}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Joined {formatJoined(profile?.createdAt)}</p>
        {instruments.length ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Instruments:{" "}
            {instruments.map((i) => i.charAt(0).toUpperCase() + i.slice(1)).join(", ")}
          </p>
        ) : null}
      </div>

      {isOwn ? (
        <Button
          type="button"
          variant="outline"
          className="mt-6 w-full"
          onClick={() => toast.info("Edit profile is not wired in this build.")}
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
    </div>
  );
}
