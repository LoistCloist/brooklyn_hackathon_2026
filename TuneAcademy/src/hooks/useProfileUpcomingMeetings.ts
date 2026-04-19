import { doc, onSnapshot } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { getFirestoreDb } from "@/lib/firebase";
import {
  ENGAGEMENTS,
  MEET_SESSIONS,
  listFutureCalendarSlots,
  subscribeEngagementsForUser,
  type FutureCalendarSlot,
  type TutoringEngagementDoc,
  type TutoringMeetSessionDoc,
} from "@/lib/tutoringFirestore";

export type ProfileUpcomingSlot = FutureCalendarSlot;

/**
 * Subscribes to tutoring engagements and each upcoming slot’s `meetSessions` doc
 * so cancellation / completion state stays in sync for both student and instructor.
 */
export function useProfileUpcomingMeetings(
  uid: string | null,
  role: "learner" | "instructor" | null,
): {
  slots: ProfileUpcomingSlot[];
  sessionByKey: Record<string, TutoringMeetSessionDoc | null>;
} {
  const [engagementRows, setEngagementRows] = useState<
    { id: string; data: TutoringEngagementDoc }[]
  >([]);

  useEffect(() => {
    return subscribeEngagementsForUser(uid, role, setEngagementRows);
  }, [uid, role]);

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

  const visibleSlots = useMemo(() => {
    return slots.filter((slot) => {
      const sess = sessionByKey[slot.key];
      if (sess?.cancelledAt) return false;
      if (sess?.sessionCompletedAt) return false;
      return true;
    });
  }, [slots, sessionByKey]);

  return { slots: visibleSlots, sessionByKey };
}
