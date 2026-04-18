import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

function isPermissionDenied(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: string }).code)
      : "";
  return code === "permission-denied";
}

export function useInstructorInvitationReelIds(instructorId: string | null): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!instructorId) {
      setIds(new Set());
      return;
    }
    const q = query(
      collection(getFirestoreDb(), "invitations"),
      where("instructorId", "==", instructorId),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = new Set<string>();
        snap.docs.forEach((d) => {
          const reelId = (d.data() as { reelId?: string }).reelId;
          if (reelId) next.add(reelId);
        });
        setIds(next);
      },
      (err) => {
        if (isPermissionDenied(err)) {
          setIds(new Set());
        }
      },
    );
    return unsub;
  }, [instructorId]);

  return ids;
}
