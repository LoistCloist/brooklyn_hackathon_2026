import { useCallback, useEffect, useState } from "react";
import {
  arrayRemove,
  arrayUnion,
  doc,
  increment,
  runTransaction,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import type { Reel } from "@/types";

export function useLike(
  reel: Reel | null,
  currentUserId: string | null,
): { isLiked: boolean; likesCount: number; toggleLike: () => Promise<void> } {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  useEffect(() => {
    if (!reel || !currentUserId) {
      setIsLiked(false);
      setLikesCount(reel?.likesCount ?? 0);
      return;
    }
    setIsLiked(reel.likedBy.includes(currentUserId));
    setLikesCount(reel.likesCount);
  }, [reel, currentUserId]);

  const toggleLike = useCallback(async () => {
    if (!reel || !currentUserId) return;
    const uid = currentUserId;
    const reelRef = doc(getFirestoreDb(), "reels", reel.id);
    const wasLiked = isLiked;
    const prevCount = likesCount;

    setIsLiked(!wasLiked);
    setLikesCount(wasLiked ? Math.max(0, prevCount - 1) : prevCount + 1);

    try {
      await runTransaction(getFirestoreDb(), async (txn) => {
        const snap = await txn.get(reelRef);
        if (!snap.exists()) {
          throw new Error("Reel no longer exists.");
        }
        const likedBy = (snap.get("likedBy") as string[] | undefined) ?? [];
        const inList = likedBy.includes(uid);
        if (inList) {
          txn.update(reelRef, {
            likedBy: arrayRemove(uid),
            likesCount: increment(-1),
          });
        } else {
          txn.update(reelRef, {
            likedBy: arrayUnion(uid),
            likesCount: increment(1),
          });
        }
      });
    } catch {
      setIsLiked(wasLiked);
      setLikesCount(prevCount);
    }
  }, [reel, currentUserId, isLiked, likesCount]);

  return { isLiked, likesCount, toggleLike };
}
