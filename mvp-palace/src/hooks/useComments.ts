import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
  type Timestamp,
} from "firebase/firestore";
import { getFirebaseAuth, getFirestoreDb } from "@/lib/firebase";
import type { Comment } from "@/types";

function mapComment(id: string, data: Record<string, unknown>): Comment {
  return {
    id,
    authorId: String(data.authorId ?? ""),
    authorName: String(data.authorName ?? ""),
    authorAvatarUrl: String(data.authorAvatarUrl ?? ""),
    text: String(data.text ?? ""),
    createdAt: data.createdAt as Timestamp,
  };
}

export function useComments(reelId: string | null): {
  comments: Comment[];
  loading: boolean;
  addComment: (text: string) => Promise<void>;
} {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reelId) {
      setComments([]);
      setLoading(false);
      return;
    }
    const db = getFirestoreDb();
    const q = query(
      collection(db, "reels", reelId, "comments"),
      orderBy("createdAt", "asc"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setComments(
          snap.docs.map((d) => mapComment(d.id, d.data() as Record<string, unknown>)),
        );
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );
    return unsub;
  }, [reelId]);

  const addComment = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!reelId || !trimmed) return;
      const auth = getFirebaseAuth();
      const u = auth.currentUser;
      if (!u) {
        throw new Error("You must be signed in to comment.");
      }
      const db = getFirestoreDb();
      const userSnap = await getDoc(doc(db, "users", u.uid));
      const userData = userSnap.exists() ? (userSnap.data() as Record<string, unknown>) : {};
      const authorName = String(userData.fullName ?? u.displayName ?? "User");
      const authorAvatarUrl = String(userData.avatarUrl ?? "");

      const batch = writeBatch(db);
      const newCommentRef = doc(collection(db, "reels", reelId, "comments"));
      batch.set(newCommentRef, {
        authorId: u.uid,
        authorName,
        authorAvatarUrl,
        text: trimmed,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, "reels", reelId), { commentsCount: increment(1) });
      try {
        await batch.commit();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to post comment.";
        throw new Error(msg);
      }
    },
    [reelId],
  );

  return { comments, loading, addComment };
}
