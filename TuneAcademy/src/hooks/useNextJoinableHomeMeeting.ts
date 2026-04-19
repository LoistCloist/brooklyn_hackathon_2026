import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { getFirestoreDb } from "@/lib/firebase";
import {
  ENGAGEMENTS,
  MEET_SESSIONS,
  listFutureCalendarSlots,
  type NextMeetingInfo,
  type TutoringEngagementDoc,
  type TutoringMeetSessionDoc,
} from "@/lib/tutoringFirestore";

/**
 * Next meeting card on Home: same calendar window as profile, but skips sessions that are
 * cancelled or already completed in Firestore (both learner and instructor stay in sync).
 */
export function useNextJoinableHomeMeeting(
  engagementRows: { id: string; data: TutoringEngagementDoc }[],
): NextMeetingInfo | null {
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const slots = useMemo(
    () => listFutureCalendarSlots(engagementRows, nowTick),
    [engagementRows, nowTick],
  );
  const slotKeysStr = useMemo(() => slots.map((s) => s.key).join("|"), [slots]);

  const [sessionByKey, setSessionByKey] = useState<
    Record<string, TutoringMeetSessionDoc | null>
  >({});

  useEffect(() => {
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
  }, [slotKeysStr, slots]);

  return useMemo(() => {
    for (const slot of slots) {
      const sess = sessionByKey[slot.key];
      if (sess?.cancelledAt) continue;
      if (sess?.sessionCompletedAt) continue;
      return {
        engagementId: slot.engagementId,
        sessionIndex: slot.sessionIndex,
        startAt: slot.startAt,
        endAt: slot.endAt,
      };
    }
    return null;
  }, [slots, sessionByKey]);
}
