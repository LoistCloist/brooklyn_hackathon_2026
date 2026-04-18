import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, getFirestoreDb } from "@/lib/firebase";
import type { Reel } from "@/types";

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
    createdAt: data.createdAt as Timestamp,
  };
}

function isPermissionDenied(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: string }).code)
      : "";
  return code === "permission-denied";
}

/**
 * Subscribes to `/reels` only after Firebase Auth has a user, so Firestore
 * `request.auth` is set (avoids permission-denied races on cold load).
 */
export function useReels(): { reels: Reel[]; loading: boolean; error: string | null } {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirestoreDb();
    let unsubSnapshot: (() => void) | undefined;

    const stopSnapshot = () => {
      unsubSnapshot?.();
      unsubSnapshot = undefined;
    };

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      stopSnapshot();
      setError(null);

      if (!user) {
        setReels([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const q = query(collection(db, "reels"), orderBy("createdAt", "desc"), limit(20));
      unsubSnapshot = onSnapshot(
        q,
        (snap) => {
          setError(null);
          setReels(
            snap.docs.map((d) => mapReelDoc(d.id, d.data() as Record<string, unknown>)),
          );
          setLoading(false);
        },
        (err) => {
          if (isPermissionDenied(err)) {
            setReels([]);
            setError(null);
          } else {
            setError(err instanceof Error ? err.message : "Could not load reels.");
          }
          setLoading(false);
        },
      );
    });

    return () => {
      unsubAuth();
      stopSnapshot();
    };
  }, []);

  return { reels, loading, error };
}
