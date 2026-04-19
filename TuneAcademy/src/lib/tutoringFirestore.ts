import {
   addDoc,
   collection,
   doc,
   getDoc,
   getDocs,
   increment,
   onSnapshot,
   query,
   runTransaction,
   serverTimestamp,
   Timestamp,
   updateDoc,
   where,
   writeBatch,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { demoMeetUri } from "@/lib/meetLinks";
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
   sessionType?: "solo" | "group";
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
   sessionType?: "solo" | "group";
   weeklySlots: WeeklyTimeSlot[];
   weeks: number;
   meetings: { startAt: Timestamp; endAt: Timestamp }[];
   createdAt?: unknown;
};

/** `tutoringEngagements/{id}/meetSessions/{sessionIndex}` — join tracking + billing for one slot. */
export type TutoringMeetSessionDoc = {
   meetLink: string;
   meetingUri?: string;
   googleCalendarEventId?: string;
   googleCalendarHtmlLink?: string;
   googleCalendarSyncedAt?: unknown;
   conferenceProvider?: "demo" | "google_calendar";
   sessionIndex: number;
   learnerOpenedAt: Timestamp | null;
   instructorOpenedAt: Timestamp | null;
   sessionCompletedAt: Timestamp | null;
   budgetCharged: boolean;
   /** USD charged to the learner when the session completes (same value used in `recordMeetLinkOpened`). */
   chargedAmountUsd?: number;
   /** Set when either party cancels; both profiles read the same doc. */
   cancelledAt?: Timestamp | null;
};

const REQUESTS = "tutoringRequests";
export const ENGAGEMENTS = "tutoringEngagements";
export const MEET_SESSIONS = "meetSessions";

export const TUTORING_MESSAGE_MAX = 2000;

/**
 * Billable amount for one scheduled meeting at a given hourly rate (kept in sync with `recordMeetLinkOpened`).
 * Used for receipts when older `meetSessions` docs omit `chargedAmountUsd`.
 */
export function computeSessionChargeUsd(
   meeting: { startAt: unknown; endAt: unknown } | undefined,
   hourlyRate: number,
): number {
   if (!meeting) return 0;
   const startMs = timestampToMillis(meeting.startAt as Timestamp | { seconds: number } | undefined);
   const endMs = timestampToMillis(meeting.endAt as Timestamp | { seconds: number } | undefined);
   if (startMs == null || endMs == null) return 0;
   const hours = Math.max(0, (endMs - startMs) / 3_600_000);
   const hourly = Number.isFinite(hourlyRate) ? hourlyRate : 0;
   return Math.round(hours * hourly * 100) / 100;
}

export async function createTutoringRequest(payload: {
   learnerId: string;
   instructorId: string;
   weeklySlots: WeeklyTimeSlot[];
   weeks: number;
   message: string;
   sessionType?: "solo" | "group";
}): Promise<string> {
   const db = getFirestoreDb();
   const msg = payload.message.trim().slice(0, TUTORING_MESSAGE_MAX);
   if (!payload.weeklySlots.length) throw new Error("Pick at least one time slot.");
   if (payload.weeks < 1) throw new Error("Choose how many weeks you want to meet.");
   const ref = await addDoc(collection(db, REQUESTS), {
      learnerId: payload.learnerId,
      instructorId: payload.instructorId,
      sessionType: payload.sessionType ?? "solo",
      weeklySlots: dedupeWeeklySlots(payload.weeklySlots),
      weeks: payload.weeks,
      message: msg,
      status: "pending" as const,
      createdAt: serverTimestamp(),
   });
   return ref.id;
}

export function subscribePendingRequestCount(instructorId: string | null, onCount: (n: number) => void): () => void {
   if (!instructorId) {
      onCount(0);
      return () => {};
   }
   const db = getFirestoreDb();
   const qy = query(collection(db, REQUESTS), where("instructorId", "==", instructorId), where("status", "==", "pending"));
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
   const qy = query(collection(db, REQUESTS), where("instructorId", "==", instructorId), where("status", "==", "pending"));
   return onSnapshot(
      qy,
      (snap) => {
         const rows = snap.docs.map((d) => ({ id: d.id, data: d.data() as TutoringRequestDoc }));
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

export async function fetchEngagementsForInstructor(instructorId: string): Promise<{ id: string; data: TutoringEngagementDoc }[]> {
   const db = getFirestoreDb();
   const snap = await getDocs(query(collection(db, ENGAGEMENTS), where("instructorId", "==", instructorId)));
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

export async function fetchEngagementsForLearner(learnerId: string): Promise<{ id: string; data: TutoringEngagementDoc }[]> {
   const db = getFirestoreDb();
   const snap = await getDocs(query(collection(db, ENGAGEMENTS), where("learnerId", "==", learnerId)));
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

export async function acceptTutoringRequest(requestId: string, instructorId: string): Promise<string> {
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
   const openTemplate = subtractRecurringHolds(dedupeWeeklySlots(inst?.weeklyAvailability ?? []), holds);
   const openKeys = new Set(openTemplate.map(slotKey));
   const allCovered = dedupeWeeklySlots(req.weeklySlots).every((s) => openKeys.has(slotKey(s)));
   if (!allCovered) {
      throw new Error("Those times are no longer available. Ask the student to send a new request.");
   }

   const proposed = materializeWeeklyMeetings(acceptAt, req.weeks, req.weeklySlots);
   if (!proposed.length) throw new Error("No valid meeting times from this request.");

   const proposedMs = proposed.map((m) => ({ start: m.start.getTime(), end: m.end.getTime() }));

   for (const { data: e } of existing) {
      if (!isEngagementActive(e.meetings, now)) continue;
      for (const m of e.meetings) {
         const s = timestampToMillis(m.startAt);
         const en = timestampToMillis(m.endAt);
         if (s == null || en == null) continue;
         for (const p of proposedMs) {
            if (meetingsOverlap(p.start, p.end, s, en)) {
               throw new Error("Accepting would overlap another student’s session. Ask them to pick different times.");
            }
         }
      }
   }

   const batch = writeBatch(db);
   batch.update(doc(db, REQUESTS, requestId), { status: "accepted" as const });
   const engRef = doc(collection(db, ENGAGEMENTS));
   const meetings = proposed.map((m) => ({ startAt: Timestamp.fromDate(m.start), endAt: Timestamp.fromDate(m.end) }));
   batch.set(engRef, {
      learnerId: req.learnerId,
      instructorId: req.instructorId,
      requestId,
      sessionType: req.sessionType ?? "solo",
      weeklySlots: dedupeWeeklySlots(req.weeklySlots),
      weeks: req.weeks,
      meetings,
      createdAt: serverTimestamp(),
   } satisfies Omit<TutoringEngagementDoc, "meetings"> & { meetings: { startAt: Timestamp; endAt: Timestamp }[] });

   const eid = engRef.id;
   for (let i = 0; i < meetings.length; i++) {
      batch.set(doc(db, ENGAGEMENTS, eid, MEET_SESSIONS, String(i)), {
         meetLink: demoMeetUri(eid, i),
         sessionIndex: i,
         learnerOpenedAt: null,
         instructorOpenedAt: null,
         sessionCompletedAt: null,
         budgetCharged: false,
         cancelledAt: null,
      });
   }

   await batch.commit();
   return eid;
}

export type NextMeetingInfo = {
   engagementId: string;
   /** Index into `meetings` / `meetSessions/{sessionIndex}`. */
   sessionIndex: number;
   startAt: Date;
   endAt: Date;
};

/** Calendar slots whose scheduled end is still in the future (same ordering as profile “upcoming”). */
export type FutureCalendarSlot = {
   key: string;
   engagementId: string;
   sessionIndex: number;
   startAt: Date;
   endAt: Date;
   learnerId: string;
   instructorId: string;
};

/**
 * Scheduled meetings that have not ended yet by wall-clock time.
 * Does not read `meetSessions` — use `useNextJoinableHomeMeeting` on the client to skip
 * cancelled or completed sessions.
 */
export function listFutureCalendarSlots(rows: { id: string; data: TutoringEngagementDoc }[], now = Date.now()): FutureCalendarSlot[] {
   const out: FutureCalendarSlot[] = [];
   for (const { id, data } of rows) {
      for (let sessionIndex = 0; sessionIndex < data.meetings.length; sessionIndex++) {
         const m = data.meetings[sessionIndex]!;
         const s = timestampToMillis(m.startAt);
         const e = timestampToMillis(m.endAt);
         if (s == null || e == null) continue;
         if (e <= now) continue;
         out.push({
            key: `${id}_${sessionIndex}`,
            engagementId: id,
            sessionIndex,
            startAt: new Date(s),
            endAt: new Date(e),
            learnerId: data.learnerId,
            instructorId: data.instructorId,
         });
      }
   }
   out.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
   return out;
}

/** Earliest calendar-future slot only; ignores cancelled/completed session state. Prefer `useNextJoinableHomeMeeting` for UI. */
export function getNextUpcomingMeeting(
   engagementRows: { id: string; data: TutoringEngagementDoc }[],
   now = Date.now(),
): NextMeetingInfo | null {
   const slots = listFutureCalendarSlots(engagementRows, now);
   const first = slots[0];
   if (!first) return null;
   return { engagementId: first.engagementId, sessionIndex: first.sessionIndex, startAt: first.startAt, endAt: first.endAt };
}

export function subscribeMeetSession(
   engagementId: string | null,
   sessionIndex: number | null,
   onData: (data: TutoringMeetSessionDoc | null) => void,
): () => void {
   if (!engagementId || sessionIndex == null || sessionIndex < 0) {
      onData(null);
      return () => {};
   }
   const db = getFirestoreDb();
   const ref = doc(db, ENGAGEMENTS, engagementId, MEET_SESSIONS, String(sessionIndex));
   return onSnapshot(
      ref,
      (snap) => {
         if (!snap.exists()) onData(null);
         else onData(snap.data() as TutoringMeetSessionDoc);
      },
      () => onData(null),
   );
}

export type RecordMeetOpenResult = "recorded" | "completed" | "noop";

/**
 * Call when the learner or instructor opens the Meet link. When both have opened,
 * marks the session complete and charges the learner's budget from their profile.
 */
export async function recordMeetLinkOpened(args: {
   uid: string;
   engagementId: string;
   sessionIndex: number;
   role: "learner" | "instructor";
}): Promise<RecordMeetOpenResult> {
   const { uid, engagementId, sessionIndex, role } = args;
   const db = getFirestoreDb();
   const engRef = doc(db, ENGAGEMENTS, engagementId);
   const sessRef = doc(db, ENGAGEMENTS, engagementId, MEET_SESSIONS, String(sessionIndex));

   return runTransaction(db, async (tx) => {
      const engSnap = await tx.get(engRef);
      if (!engSnap.exists()) throw new Error("Engagement not found.");
      const eng = engSnap.data() as TutoringEngagementDoc;
      if (eng.learnerId !== uid && eng.instructorId !== uid) throw new Error("Not part of this session.");

      const sessSnap = await tx.get(sessRef);
      const instRef = doc(db, "instructors", eng.instructorId);
      const instSnap = await tx.get(instRef);
      const userRef = doc(db, "users", eng.learnerId);

      const sess = sessSnap.exists() ? (sessSnap.data() as TutoringMeetSessionDoc) : null;
      if (sess?.sessionCompletedAt) return "noop";
      if (sess?.cancelledAt) throw new Error("This meeting was cancelled.");

      const openKey = role === "learner" ? "learnerOpenedAt" : "instructorOpenedAt";
      const alreadyMine = sess?.[openKey] != null;

      const learnerNext = sess?.learnerOpenedAt != null || role === "learner";
      const instructorNext = sess?.instructorOpenedAt != null || role === "instructor";

      if (!sessSnap.exists()) {
         tx.set(sessRef, {
            meetLink: demoMeetUri(engagementId, sessionIndex),
            sessionIndex,
            learnerOpenedAt: role === "learner" ? serverTimestamp() : null,
            instructorOpenedAt: role === "instructor" ? serverTimestamp() : null,
            sessionCompletedAt: null,
            budgetCharged: false,
            cancelledAt: null,
         });
      } else if (!alreadyMine) {
         tx.update(sessRef, { [openKey]: serverTimestamp() });
      }

      if (!learnerNext || !instructorNext) {
         return alreadyMine ? "noop" : "recorded";
      }

      const meeting = eng.meetings[sessionIndex];
      if (!meeting) throw new Error("Invalid session index.");
      const startMs = timestampToMillis(meeting.startAt as never);
      const endMs = timestampToMillis(meeting.endAt as never);
      if (startMs == null || endMs == null) throw new Error("Bad meeting times.");

      const hourly = (instSnap.data() as { hourlyRate?: number } | undefined)?.hourlyRate ?? 0;
      const chargeUsd = computeSessionChargeUsd(meeting, hourly);

      tx.update(sessRef, { sessionCompletedAt: serverTimestamp(), budgetCharged: true, chargedAmountUsd: chargeUsd });

      if (chargeUsd > 0) {
         tx.update(userRef, { learningBudgetSpentUsd: increment(chargeUsd) });
      }

      return "completed";
   });
}

export async function cancelMeetingSession(args: { uid: string; engagementId: string; sessionIndex: number }): Promise<void> {
   const { uid, engagementId, sessionIndex } = args;
   const db = getFirestoreDb();
   const engRef = doc(db, ENGAGEMENTS, engagementId);
   const sessRef = doc(db, ENGAGEMENTS, engagementId, MEET_SESSIONS, String(sessionIndex));

   await runTransaction(db, async (tx) => {
      const engSnap = await tx.get(engRef);
      if (!engSnap.exists()) throw new Error("Engagement not found.");
      const eng = engSnap.data() as TutoringEngagementDoc;
      if (eng.learnerId !== uid && eng.instructorId !== uid) {
         throw new Error("You are not part of this session.");
      }

      const meeting = eng.meetings[sessionIndex];
      if (!meeting) throw new Error("Invalid session.");

      const endMs = timestampToMillis(meeting.endAt);
      if (endMs == null) throw new Error("Invalid meeting time.");
      if (endMs <= Date.now()) throw new Error("This meeting has already ended.");

      const sessSnap = await tx.get(sessRef);
      if (sessSnap.exists()) {
         const sess = sessSnap.data() as TutoringMeetSessionDoc;
         if (sess.sessionCompletedAt) throw new Error("Cannot cancel a completed session.");
         if (sess.cancelledAt) throw new Error("This meeting is already cancelled.");
      }

      if (!sessSnap.exists()) {
         tx.set(sessRef, {
            meetLink: demoMeetUri(engagementId, sessionIndex),
            sessionIndex,
            learnerOpenedAt: null,
            instructorOpenedAt: null,
            sessionCompletedAt: null,
            budgetCharged: false,
            cancelledAt: serverTimestamp(),
         });
      } else {
         tx.update(sessRef, { cancelledAt: serverTimestamp() });
      }
   });
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
         const rows = snap.docs.map((d) => ({ id: d.id, data: d.data() as TutoringEngagementDoc }));
         onRows(rows);
      },
      () => onRows([]),
   );
}
