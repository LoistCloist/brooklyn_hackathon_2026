import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import type { UserFirestoreDoc } from "@/lib/musilearnFirestore";

export function useFirestoreUserDoc(uid: string | null): {
  user: UserFirestoreDoc | null;
  loading: boolean;
} {
  const [user, setUser] = useState<UserFirestoreDoc | null>(null);
  const [loading, setLoading] = useState(Boolean(uid));

  useEffect(() => {
    if (!uid) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = onSnapshot(
      doc(getFirestoreDb(), "users", uid),
      (snap) => {
        if (!snap.exists()) {
          setUser(null);
        } else {
          setUser(snap.data() as UserFirestoreDoc);
        }
        setLoading(false);
      },
      () => {
        setUser(null);
        setLoading(false);
      },
    );
    return unsub;
  }, [uid]);

  return { user, loading };
}
