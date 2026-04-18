import { useEffect, useMemo, useState } from "react";
import {
  collection,
  documentId,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, getFirestoreDb } from "@/lib/firebase";
import { firestoreLikeToMillisOrZero } from "@/lib/firestoreTime";
import type { Reel } from "@/types";
import type { UserFirestoreDoc } from "@/lib/tuneacademyFirestore";

function isPermissionDenied(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: string }).code)
      : "";
  return code === "permission-denied";
}

function mapReelDoc(id: string, data: Record<string, unknown>): Reel {
  return {
    id,
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
}

function inviteRank(s: "pending" | "accepted" | "declined"): number {
  if (s === "accepted") return 3;
  if (s === "pending") return 2;
  return 1;
}

export type LearnerDirectoryRow = {
  id: string;
  doc: UserFirestoreDoc;
  reelCount: number;
  instruments: string[];
  spotlightReel: Reel | null;
  inviteStatus: "none" | "pending" | "accepted" | "declined";
};

export function useLearnersDirectory(instructorId: string | null): {
  rows: LearnerDirectoryRow[];
  loading: boolean;
  error: string | null;
} {
  const [entries, setEntries] = useState<{ id: string; doc: UserFirestoreDoc }[]>([]);
  const [reelsByUser, setReelsByUser] = useState<
    Map<string, { reels: Reel[]; instruments: Set<string> }>
  >(() => new Map());
  const [inviteByLearner, setInviteByLearner] = useState<
    Map<string, "pending" | "accepted" | "declined">
  >(() => new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirestoreDb();
    const unsubs: Array<() => void> = [];

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubs.forEach((u) => u());
      unsubs.length = 0;
      setError(null);
      setEntries([]);
      setReelsByUser(new Map());
      setInviteByLearner(new Map());

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const qUsers = query(collection(db, "users"), where("role", "==", "learner"));
      unsubs.push(
        onSnapshot(
          qUsers,
          (snap) => {
            setError(null);
            const list = snap.docs.map((d) => ({
              id: d.id,
              doc: d.data() as UserFirestoreDoc,
            }));
            setEntries(list);
            setLoading(false);
          },
          (err) => {
            if (isPermissionDenied(err)) {
              setEntries([]);
              setError(null);
            } else {
              setError(err instanceof Error ? err.message : "Could not load learners.");
            }
            setLoading(false);
          },
        ),
      );

      // Order by document id only so Firestore never has to compare possibly-missing `createdAt`
      // values server-side; we sort by time client-side after mapping.
      const qReels = query(collection(db, "reels"), orderBy(documentId()), limit(100));
      unsubs.push(
        onSnapshot(
          qReels,
          (snap) => {
            const byUser = new Map<string, { reels: Reel[]; instruments: Set<string> }>();
            snap.docs.forEach((docSnap) => {
              try {
                const r = mapReelDoc(docSnap.id, docSnap.data() as Record<string, unknown>);
                if (!r.uploaderId) return;
                const cur = byUser.get(r.uploaderId) ?? {
                  reels: [],
                  instruments: new Set<string>(),
                };
                cur.reels.push(r);
                if (r.instrument.trim()) cur.instruments.add(r.instrument.trim().toLowerCase());
                byUser.set(r.uploaderId, cur);
              } catch {
                /* skip malformed reel docs */
              }
            });
            for (const v of byUser.values()) {
              v.reels.sort(
                (a, b) =>
                  firestoreLikeToMillisOrZero(b.createdAt) -
                  firestoreLikeToMillisOrZero(a.createdAt),
              );
            }
            setReelsByUser(byUser);
          },
          (err) => {
            if (!isPermissionDenied(err)) {
              setError(err instanceof Error ? err.message : "Could not load reels.");
            }
          },
        ),
      );

      if (instructorId) {
        const qInv = query(
          collection(db, "invitations"),
          where("instructorId", "==", instructorId),
        );
        unsubs.push(
          onSnapshot(
            qInv,
            (snap) => {
              const next = new Map<string, "pending" | "accepted" | "declined">();
              snap.docs.forEach((d) => {
                const data = d.data() as {
                  learnerId?: string;
                  status?: string;
                };
                const lid = String(data.learnerId ?? "");
                const st = data.status;
                if (!lid || (st !== "pending" && st !== "accepted" && st !== "declined")) return;
                const prev = next.get(lid);
                const nextRank = inviteRank(st);
                const prevRank = prev ? inviteRank(prev) : 0;
                if (nextRank >= prevRank) next.set(lid, st);
              });
              setInviteByLearner(next);
            },
            () => {
              /* invitations optional */
            },
          ),
        );
      }
    });

    return () => {
      unsubAuth();
      unsubs.forEach((u) => u());
    };
  }, [instructorId]);

  const rows = useMemo((): LearnerDirectoryRow[] => {
    return entries
      .map(({ id, doc }) => {
        const pack = reelsByUser.get(id);
        const reels = pack?.reels ?? [];
        const instruments = pack ? [...pack.instruments].sort() : [];
        const spotlightReel = reels[0] ?? null;
        const inviteStatus = inviteByLearner.get(id) ?? "none";
        return {
          id,
          doc,
          reelCount: reels.length,
          instruments,
          spotlightReel,
          inviteStatus,
        } satisfies LearnerDirectoryRow;
      })
      .sort((a, b) =>
        (a.doc.fullName || "").localeCompare(b.doc.fullName || "", undefined, {
          sensitivity: "base",
        }),
      );
  }, [entries, reelsByUser, inviteByLearner]);

  return { rows, loading, error };
}
