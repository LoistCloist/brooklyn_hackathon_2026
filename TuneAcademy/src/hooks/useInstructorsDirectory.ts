import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth, getFirestoreDb } from "@/lib/firebase";
import type { InstructorFirestoreDoc } from "@/lib/tuneacademyFirestore";

function isPermissionDenied(err: unknown): boolean {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: string }).code)
      : "";
  return code === "permission-denied";
}

/** Display label for a specialty slug stored in Firestore (e.g. `voice` → Voice). */
export function formatSpecialtyLabel(slug: string): string {
  const s = slug.trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export type InstructorDirectoryRow = {
  id: string;
  doc: InstructorFirestoreDoc;
};

export function useInstructorsDirectory(): {
  rows: InstructorDirectoryRow[];
  loading: boolean;
  error: string | null;
} {
  const [rows, setRows] = useState<InstructorDirectoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const db = getFirestoreDb();
    let unsubInst: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (unsubInst) {
        unsubInst();
        unsubInst = null;
      }
      setError(null);
      setRows([]);

      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      unsubInst = onSnapshot(
        collection(db, "instructors"),
        (snap) => {
          setError(null);
          const list: InstructorDirectoryRow[] = [];
          for (const d of snap.docs) {
            const doc = d.data() as InstructorFirestoreDoc;
            if (!doc.bio?.trim()) continue;
            list.push({ id: d.id, doc });
          }
          list.sort((a, b) =>
            (a.doc.fullName || "").localeCompare(b.doc.fullName || "", undefined, {
              sensitivity: "base",
            }),
          );
          setRows(list);
          setLoading(false);
        },
        (err) => {
          if (isPermissionDenied(err)) {
            setError("You do not have permission to browse instructors.");
          } else {
            setError("Could not load instructors.");
          }
          setRows([]);
          setLoading(false);
        },
      );
    });

    return () => {
      unsubAuth();
      if (unsubInst) unsubInst();
    };
  }, []);

  return { rows, loading, error };
}
