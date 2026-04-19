import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useRef, useState } from "react";
import { getFirestoreDb } from "@/lib/firebase";
import {
  ENGAGEMENTS,
  MEET_SESSIONS,
  type TutoringEngagementDoc,
  type TutoringMeetSessionDoc,
} from "@/lib/tutoringFirestore";

export type EngagementSessionSlot = {
  key: string;
  engagementId: string;
  sessionIndex: number;
};

/** Stable key for `tutoringEngagements/{id}/meetSessions/{sessionIndex}` (matches profile / home helpers). */
export function engagementMeetSessionKey(engagementId: string, sessionIndex: number): string {
  return `${engagementId}_${sessionIndex}`;
}

function listSlotsForEngagements(engagementRows: { id: string; data: TutoringEngagementDoc }[]): EngagementSessionSlot[] {
  const out: EngagementSessionSlot[] = [];
  for (const { id, data } of engagementRows) {
    for (let sessionIndex = 0; sessionIndex < data.meetings.length; sessionIndex++) {
      out.push({
        key: engagementMeetSessionKey(id, sessionIndex),
        engagementId: id,
        sessionIndex,
      });
    }
  }
  return out;
}

/**
 * When engagement ids or per-engagement meeting counts change, listeners must be re-wired.
 * (Firestore snapshots use new array references; this string stays stable across identical data.)
 */
function engagementMeetSessionsFingerprint(rows: { id: string; data: TutoringEngagementDoc }[] | null): string {
  if (!rows?.length) return "";
  return [...rows]
    .map(({ id, data }) => `${id}:${data.meetings.length}`)
    .sort()
    .join("|");
}

/**
 * Subscribes to every `meetSessions` doc for the given engagements (all scheduled indices).
 * Used when dashboard logic must reflect `sessionCompletedAt` (both parties opened the Meet link).
 */
export function useEngagementMeetSessionsMap(
  engagementRows: { id: string; data: TutoringEngagementDoc }[] | null,
): Record<string, TutoringMeetSessionDoc | null> {
  const rowsRef = useRef(engagementRows);
  rowsRef.current = engagementRows;

  const slotKeysStr = useMemo(() => engagementMeetSessionsFingerprint(engagementRows), [engagementRows]);

  const [sessionByKey, setSessionByKey] = useState<Record<string, TutoringMeetSessionDoc | null>>({});

  useEffect(() => {
    const rows = rowsRef.current;
    if (!rows?.length) {
      setSessionByKey({});
      return;
    }
    const slots = listSlotsForEngagements(rows);
    if (!slots.length) {
      setSessionByKey({});
      return;
    }
    const db = getFirestoreDb();
    setSessionByKey({});
    const unsubs = slots.map((slot) =>
      onSnapshot(
        doc(db, ENGAGEMENTS, slot.engagementId, MEET_SESSIONS, String(slot.sessionIndex)),
        (snap) => {
          setSessionByKey((prev) => ({
            ...prev,
            [slot.key]: snap.exists() ? (snap.data() as TutoringMeetSessionDoc) : null,
          }));
        },
        () => {
          setSessionByKey((prev) => ({ ...prev, [slot.key]: null }));
        },
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [slotKeysStr]);

  return sessionByKey;
}
