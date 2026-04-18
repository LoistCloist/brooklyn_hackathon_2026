import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getFirestoreDb } from "@/lib/firebase";
import { chatIdForUserPair } from "@/lib/messaging";
import type { InstructorFirestoreDoc, UserFirestoreDoc } from "@/lib/musilearnFirestore";
import type { Reel } from "@/types";

type ReportRow = {
  instrument?: string;
  overallScore?: number;
  weaknesses?: string[];
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reel: Reel | null;
  instructorId: string;
  instructorName: string;
  onSent: () => void;
};

function formatJoined(ts: unknown): string {
  if (
    ts &&
    typeof ts === "object" &&
    "toDate" in ts &&
    typeof (ts as { toDate: () => Date }).toDate === "function"
  ) {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  return "—";
}

export function RecruitDialog({
  open,
  onOpenChange,
  reel,
  instructorId,
  instructorName,
  onSent,
}: Props) {
  const learnerId = reel?.uploaderId ?? "";
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [learner, setLearner] = useState<UserFirestoreDoc | null>(null);
  const [report, setReport] = useState<ReportRow | null>(null);
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [message, setMessage] = useState("");

  const learnerName = learner?.fullName?.trim() || reel?.uploaderName || "Learner";

  const defaultMessage = useMemo(() => {
    const spec = specialties.length ? specialties.join(", ") : "music performance";
    return `Hi ${learnerName}, I saw your reel and I think I can help you improve. I specialise in ${spec}. Would you like to connect?`;
  }, [learnerName, specialties]);

  useEffect(() => {
    if (!open || !learnerId) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const db = getFirestoreDb();
        const learnerSnap = await getDoc(doc(db, "users", learnerId));
        if (!cancelled) {
          setLearner(learnerSnap.exists() ? (learnerSnap.data() as UserFirestoreDoc) : null);
        }

        const repQuery = query(
          collection(db, "reports"),
          where("userId", "==", learnerId),
          orderBy("createdAt", "desc"),
          limit(1),
        );
        const repSnap = await getDocs(repQuery);
        if (!cancelled) {
          if (repSnap.empty) setReport(null);
          else setReport(repSnap.docs[0].data() as ReportRow);
        }

        const instSnap = await getDoc(doc(db, "instructors", instructorId));
        if (!cancelled) {
          if (instSnap.exists()) {
            const inst = instSnap.data() as InstructorFirestoreDoc;
            setSpecialties(Array.isArray(inst.specialties) ? inst.specialties : []);
          } else {
            setSpecialties([]);
          }
        }
      } catch {
        if (!cancelled) {
          setLearner(null);
          setReport(null);
          setSpecialties([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [open, learnerId, instructorId]);

  useEffect(() => {
    if (open) setMessage(defaultMessage);
  }, [open, defaultMessage]);

  const weaknesses = (report?.weaknesses ?? []).slice(0, 3);

  const send = async () => {
    const text = message.trim();
    if (!text || !reel) return;
    setPosting(true);
    try {
      const db = getFirestoreDb();
      const batch = writeBatch(db);
      const invRef = doc(collection(db, "invitations"));
      batch.set(invRef, {
        instructorId,
        instructorName,
        learnerId,
        learnerName,
        reelId: reel.id,
        message: text,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      const chatId = chatIdForUserPair(instructorId, learnerId);
      const msgRef = doc(collection(db, "messages", chatId, "messages"));
      batch.set(msgRef, {
        senderId: instructorId,
        text,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      toast.success(`Invitation sent to ${learnerName}!`);
      onSent();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send invitation.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !posting && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Recruit learner</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Learner
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-full bg-muted text-2xl font-bold">
                  {(learnerName[0] ?? "?").toUpperCase()}
                </div>
                <div>
                  <p className="text-lg font-semibold">{learnerName}</p>
                  <p className="text-muted-foreground">Joined {formatJoined(learner?.createdAt)}</p>
                </div>
              </div>
            </div>

            {report ? (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="font-medium capitalize">
                  {String(report.instrument ?? "Instrument")}
                </p>
                <p className="mt-2 font-semibold">
                  Score: {typeof report.overallScore === "number" ? report.overallScore : "—"} / 100
                </p>
                {weaknesses.length ? (
                  <ul className="mt-2 list-inside list-disc text-muted-foreground">
                    {weaknesses.map((w, i) => (
                      <li key={`${i}-${w.slice(0, 24)}`}>{w}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">Based on latest analysis</p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                This learner has not submitted an analysis yet.
              </p>
            )}

            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Send an invitation message
              </p>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                maxLength={500}
                className="min-h-[100px]"
                disabled={posting}
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">
                {message.length} / 500
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={posting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={() => void send()} disabled={posting || loading}>
            {posting ? "Sending…" : "Send invitation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
