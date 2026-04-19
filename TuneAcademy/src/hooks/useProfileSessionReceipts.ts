import { useEffect, useMemo, useState } from "react";
import { firestoreLikeToMillisOrZero } from "@/lib/firestoreTime";
import {
   computeSessionChargeUsd,
   subscribeEngagementsForUser,
   type TutoringEngagementDoc,
   type TutoringMeetSessionDoc,
} from "@/lib/tutoringFirestore";
import { getInstructorDoc, getUserDoc } from "@/lib/tuneacademyFirestore";
import { timestampToMillis } from "@/lib/scheduling";
import { engagementMeetSessionKey, useEngagementMeetSessionsMap } from "@/hooks/useEngagementMeetSessionsMap";

export type SessionReceiptRow = {
   key: string;
   engagementId: string;
   sessionIndex: number;
   counterpartyId: string;
   sessionStart: Date;
   sessionEnd: Date;
   completedAt: Date;
   amountUsd: number;
   amountIsRecorded: boolean;
};

function isCompletedSession(sess: TutoringMeetSessionDoc | null | undefined): sess is TutoringMeetSessionDoc {
   return Boolean(sess?.sessionCompletedAt && !sess.cancelledAt);
}

export function useProfileSessionReceipts(
   uid: string | null,
   role: "learner" | "instructor" | null,
): { receipts: SessionReceiptRow[]; counterpartyNames: Record<string, string> } {
   const [engagementRows, setEngagementRows] = useState<{ id: string; data: TutoringEngagementDoc }[]>([]);

   useEffect(() => {
      return subscribeEngagementsForUser(uid, role, setEngagementRows);
   }, [uid, role]);

   const sessionByKey = useEngagementMeetSessionsMap(engagementRows);

   const [hourlyByInstructor, setHourlyByInstructor] = useState<Record<string, number>>({});

   useEffect(() => {
      const need = new Set<string>();
      for (const { id, data } of engagementRows) {
         for (let sessionIndex = 0; sessionIndex < data.meetings.length; sessionIndex++) {
            const sess = sessionByKey[engagementMeetSessionKey(id, sessionIndex)];
            if (!isCompletedSession(sess)) continue;
            if (typeof sess.chargedAmountUsd === "number") continue;
            need.add(data.instructorId);
         }
      }
      if (need.size === 0) {
         setHourlyByInstructor({});
         return;
      }
      let cancelled = false;
      void Promise.all(
         [...need].map(async (instructorId) => {
            const inst = await getInstructorDoc(instructorId);
            return [instructorId, inst?.hourlyRate ?? 0] as const;
         }),
      ).then((pairs) => {
         if (!cancelled) setHourlyByInstructor(Object.fromEntries(pairs));
      });
      return () => {
         cancelled = true;
      };
   }, [engagementRows, sessionByKey]);

   const receipts = useMemo(() => {
      const out: SessionReceiptRow[] = [];
      for (const { id, data } of engagementRows) {
         for (let sessionIndex = 0; sessionIndex < data.meetings.length; sessionIndex++) {
            const key = engagementMeetSessionKey(id, sessionIndex);
            const sess = sessionByKey[key];
            if (!isCompletedSession(sess)) continue;
            const meeting = data.meetings[sessionIndex];
            if (!meeting) continue;
            const startMs = timestampToMillis(meeting.startAt as never);
            const endMs = timestampToMillis(meeting.endAt as never);
            if (startMs == null || endMs == null) continue;

            const counterpartyId = role === "learner" ? data.instructorId : data.learnerId;
            const amountRecorded = typeof sess.chargedAmountUsd === "number";
            const hourly = hourlyByInstructor[data.instructorId] ?? 0;
            const amountUsd = amountRecorded ? sess.chargedAmountUsd! : computeSessionChargeUsd(meeting, hourly);
            const completedAtMs = firestoreLikeToMillisOrZero(sess.sessionCompletedAt);

            out.push({
               key,
               engagementId: id,
               sessionIndex,
               counterpartyId,
               sessionStart: new Date(startMs),
               sessionEnd: new Date(endMs),
               completedAt: new Date(completedAtMs),
               amountUsd,
               amountIsRecorded: amountRecorded,
            });
         }
      }
      out.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
      return out;
   }, [engagementRows, sessionByKey, role, hourlyByInstructor]);

   const counterpartyIdsKey = useMemo(() => {
      const ids = new Set(receipts.map((r) => r.counterpartyId));
      return [...ids].sort().join("|");
   }, [receipts]);

   const [counterpartyNames, setCounterpartyNames] = useState<Record<string, string>>({});

   useEffect(() => {
      if (!counterpartyIdsKey) {
         setCounterpartyNames({});
         return;
      }
      const ids = counterpartyIdsKey.split("|").filter(Boolean);
      let cancelled = false;
      void Promise.all(
         ids.map(async (userId) => {
            const u = await getUserDoc(userId);
            const label = u?.fullName?.trim() || u?.email?.split("@")[0]?.trim() || "User";
            return [userId, label] as const;
         }),
      ).then((pairs) => {
         if (!cancelled) setCounterpartyNames(Object.fromEntries(pairs));
      });
      return () => {
         cancelled = true;
      };
   }, [counterpartyIdsKey]);

   return { receipts, counterpartyNames };
}
