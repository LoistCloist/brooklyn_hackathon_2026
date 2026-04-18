import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import {
  dedupeWeeklySlots,
  flattenEngagementHolds,
  isEngagementActive,
  materializeWeeklyMeetings,
  meetingsOverlap,
  subtractRecurringHolds,
  timestampToMillis,
  slotKey,
  type WeeklyTimeSlot,
} from "@/lib/scheduling";
import { getInstructorDoc } from "@/lib/tuneacademyFirestore";

export type TutoringRequestStatus = "pending" | "accepted" | "declined";

export type TutoringRequestDoc = {
  learnerId: string;
  instructorId: string;
  weeklySlots: WeeklyTimeSlot[];
  weeks: number;
  message: string;
  status: TutoringRequestStatus;
  createdAt?: unknown;
};

export type TutoringEngagementDoc = {
  learnerId: string;
  instructorId: string;
  requestId: string;
  weeklySlots: WeeklyTimeSlot[];
  weeks: number;
  meetings: { startAt: Timestamp; endAt: Timestamp }[];
  createdAt?: unknown;
};

const REQUESTS = "tutoringRequests";
const ENGAGEMENTS = "tutoringEngagements";

export const TUTORING_MESSAGE_MAX = 2000;

export async function createTutoringRequest(payload: {
  learnerId: string;
  instructorId: string;
  weeklySlots: WeeklyTimeSlot[];
  weeks: number;
  message: string;
}): Promise<string> {
  const db = getFirestoreDb();
  const msg = payload.message.trim().slice(0, TUTORING_MESSAGE_MAX);
  if (!payload.weeklySlots.length) throw new Error("Pick at least one time slot.");
  if (payload.weeks < 1) throw new Error("Choose how many weeks you want to meet.");
  const ref = await addDoc(collection(db, REQUESTS), {
    learnerId: payload.learnerId,
    instructorId: payload.instructorId,
    weeklySlots: dedupeWeeklySlots(payload.weeklySlots),
    weeks: payload.weeks,
    message: msg,
    status: "pending" as const,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export function subscribePendingRequestCount(
  instructorId: string | null,
  onCount: (n: number) => void,
): () => void {
  if (!instructorId) {
    onCount(0);
    return () => {};
  }
  const db = getFirestoreDb();
  const qy = query(
    collection(db, REQUESTS),
    where("instructorId", "==", instructorId),
    where("status", "==", "pending"),
  );
  return onSnapshot(
    qy,
    (snap) => onCount(snap.size),
    () => onCount(0),
  );
}

export function subscribePendingRequestsForInstructor(
  instructorId: string | null,
  onRows: (rows: { id: string; data: TutoringRequestDoc }[]) => void,
): () => void {
  if (!instructorId) {
    onRows([]);
    return () => {};
  }
  const db = getFirestoreDb();
  const qy = query(
    collection(db, REQUESTS),
    where("instructorId", "==", instructorId),
    where("status", "==", "pending"),
  );
  return onSnapshot(
    qy,
    (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        data: d.data() as TutoringRequestDoc,
      }));
      rows.sort((a, b) => {
        const ma = timestampToMillis(a.data.createdAt as never) ?? 0;
        const mb = timestampToMillis(b.data.createdAt as never) ?? 0;
        return mb - ma;
      });
      onRows(rows);
    },
    () => onRows([]),
  );
}

export async function fetchEngagementsForInstructor(
  instructorId: string,
): Promise<{ id: string; data: TutoringEngagementDoc }[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(
    query(collection(db, ENGAGEMENTS), where("instructorId", "==", instructorId)),
  );
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as TutoringEngagementDoc }));
}

export function subscribeEngagementsForInstructor(
  instructorId: string | null,
  onRows: (rows: { id: string; data: TutoringEngagementDoc }[]) => void,
): () => void {
  if (!instructorId) {
    onRows([]);
    return () => {};
  }
  const db = getFirestoreDb();
  const qy = query(collection(db, ENGAGEMENTS), where("instructorId", "==", instructorId));
  return onSnapshot(
    qy,
    (snap) => {
      onRows(snap.docs.map((d) => ({ id: d.id, data: d.data() as TutoringEngagementDoc })));
    },
    () => onRows([]),
  );
}

export async function fetchEngagementsForLearner(
  learnerId: string,
): Promise<{ id: string; data: TutoringEngagementDoc }[]> {
  const db = getFirestoreDb();
  const snap = await getDocs(
    query(collection(db, ENGAGEMENTS), where("learnerId", "==", learnerId)),
  );
  return snap.docs.map((d) => ({ id: d.id, data: d.data() as TutoringEngagementDoc }));
}

export async function declineTutoringRequest(requestId: string, instructorId: string): Promise<void> {
  const db = getFirestoreDb();
  const ref = doc(db, REQUESTS, requestId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Request not found.");
  const r = snap.data() as TutoringRequestDoc;
  if (r.instructorId !== instructorId) throw new Error("Not your request.");
  await updateDoc(ref, { status: "declined" as const });
}

export async function acceptTutoringRequest(
  requestId: string,
  instructorId: string,
): Promise<string> {
  const db = getFirestoreDb();
  const reqSnap = await getDoc(doc(db, REQUESTS, requestId));
  if (!reqSnap.exists()) throw new Error("Request not found.");
  const req = reqSnap.data() as TutoringRequestDoc;
  if (req.instructorId !== instructorId) throw new Error("Not your request.");
  if (req.status !== "pending") throw new Error("Already handled.");

  const inst = await getInstructorDoc(instructorId);
  const maxWeeks = Math.min(52, Math.max(1, inst?.maxTutoringWeeks ?? 12));
  if (req.weeks > maxWeeks) throw new Error(`This learner requested more than ${maxWeeks} weeks.`);

  const existing = await fetchEngagementsForInstructor(instructorId);
  const now = Date.now();
  const acceptAt = new Date();
  const holds = flattenEngagementHolds(
    existing.map((e) => ({ weeklySlots: e.data.weeklySlots, meetings: e.data.meetings })),
    now,
  );
  const openTemplate = subtractRecurringHolds(
    dedupeWeeklySlots(inst?.weeklyAvailability ?? []),
    holds,
  );
  const openKeys = new Set(openTemplate.map(slotKey));
  const allCovered = dedupeWeeklySlots(req.weeklySlots).every((s) => openKeys.has(slotKey(s)));
  if (!allCovered) {
    throw new Error("Those times are no longer available. Ask the student to send a new request.");
  }

  const proposed = materializeWeeklyMeetings(acceptAt, req.weeks, req.weeklySlots);
  if (!proposed.length) throw new Error("No valid meeting times from this request.");

  const proposedMs = proposed.map((m) => ({
    start: m.start.getTime(),
    end: m.end.getTime(),
  }));

  for (const { data: e } of existing) {
    if (!isEngagementActive(e.meetings, now)) continue;
    for (const m of e.meetings) {
      const s = timestampToMillis(m.startAt);
      const en = timestampToMillis(m.endAt);
      if (s == null || en == null) continue;
      for (const p of proposedMs) {
        if (meetingsOverlap(p.start, p.end, s, en)) {
          throw new Error(
            "Accepting would overlap another student’s session. Ask them to pick different times.",
          );
        }
      }
    }
  }

  const batch = writeBatch(db);
  batch.update(doc(db, REQUESTS, requestId), { status: "accepted" as const });
  const engRef = doc(collection(db, ENGAGEMENTS));
  const meetings = proposed.map((m) => ({
    startAt: Timestamp.fromDate(m.start),
    endAt: Timestamp.fromDate(m.end),
  }));
  batch.set(engRef, {
    learnerId: req.learnerId,
    instructorId: req.instructorId,
    requestId,
    weeklySlots: dedupeWeeklySlots(req.weeklySlots),
    weeks: req.weeks,
    meetings,
    createdAt: serverTimestamp(),
  } satisfies Omit<TutoringEngagementDoc, "meetings"> & {
    meetings: { startAt: Timestamp; endAt: Timestamp }[];
  });
  await batch.commit();
  return engRef.id;
}

export type NextMeetingInfo = {
  engagementId: string;
  startAt: Date;
  endAt: Date;
};

export function getNextUpcomingMeeting(
  engagementRows: { id: string; data: TutoringEngagementDoc }[],
  now = Date.now(),
): NextMeetingInfo | null {
  let best: NextMeetingInfo | null = null;
  let bestStart = Infinity;
  for (const { id, data } of engagementRows) {
    for (const m of data.meetings) {
      const s = timestampToMillis(m.startAt);
      const e = timestampToMillis(m.endAt);
      if (s == null || e == null) continue;
      if (e <= now) continue;
      if (s < bestStart) {
        bestStart = s;
        best = {
          engagementId: id,
          startAt: new Date(s),
          endAt: new Date(e),
        };
      }
    }
  }
  return best;
}

export function subscribeEngagementsForUser(
  uid: string | null,
  role: "learner" | "instructor" | null,
  onRows: (rows: { id: string; data: TutoringEngagementDoc }[]) => void,
): () => void {
  if (!uid || !role) {
    onRows([]);
    return () => {};
  }
  const db = getFirestoreDb();
  const field = role === "instructor" ? "instructorId" : "learnerId";
  const qy = query(collection(db, ENGAGEMENTS), where(field, "==", uid));
  return onSnapshot(
    qy,
    (snap) => {
      const rows = snap.docs.map((d) => ({
        id: d.id,
        data: d.data() as TutoringEngagementDoc,
      }));
      onRows(rows);
    },
    () => onRows([]),
  );
}
