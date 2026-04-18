import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";
import { firestoreLikeToMillisOrZero } from "@/lib/firestoreTime";
import { chatIdForUserPair, DIRECT_INSTRUCTOR_DM_REEL_ID } from "@/lib/messaging";
import type { UserRole } from "@/lib/tuneacademyFirestore";
import type { ChatMessage, Invitation } from "@/types";

export type MessagingConversation = {
  chatId: string;
  instructorId: string;
  learnerId: string;
  otherUserId: string;
  otherDisplayName: string;
  otherAvatarUrl: string;
  /** Latest invitation time for this pair (ms) */
  lastInviteActivityMs: number;
};

function tsToMillis(ts: unknown): number {
  return firestoreLikeToMillisOrZero(ts);
}

function parseInvitation(id: string, data: Record<string, unknown>): Invitation {
  const status = data.status;
  return {
    id,
    instructorId: String(data.instructorId ?? ""),
    instructorName: String(data.instructorName ?? "Instructor"),
    learnerId: String(data.learnerId ?? ""),
    learnerName: data.learnerName != null ? String(data.learnerName) : undefined,
    reelId: String(data.reelId ?? ""),
    message: String(data.message ?? ""),
    status: status === "accepted" || status === "declined" ? status : "pending",
    createdAt: data.createdAt as Invitation["createdAt"],
  };
}

function mergeInvitationsToConversations(
  uid: string,
  parts: Invitation[],
): MessagingConversation[] {
  const byChat = new Map<
    string,
    { inv: Invitation; lastMs: number; instructorId: string; learnerId: string; chatId: string }
  >();

  for (const inv of parts) {
    if (!inv.instructorId || !inv.learnerId) continue;
    const chatId = chatIdForUserPair(inv.instructorId, inv.learnerId);
    const ms = tsToMillis(inv.createdAt);
    const prev = byChat.get(chatId);
    if (!prev || ms >= prev.lastMs) {
      byChat.set(chatId, {
        inv,
        lastMs: ms,
        instructorId: inv.instructorId,
        learnerId: inv.learnerId,
        chatId,
      });
    }
  }

  const rows: MessagingConversation[] = [];
  for (const { inv, lastMs, instructorId, learnerId, chatId } of byChat.values()) {
    const imInstructor = uid === instructorId;
    const otherUserId = imInstructor ? learnerId : instructorId;
    const otherDisplayName = imInstructor
      ? inv.learnerName?.trim() || "Learner"
      : inv.instructorName.trim() || "Instructor";

    rows.push({
      chatId,
      instructorId,
      learnerId,
      otherUserId,
      otherDisplayName,
      otherAvatarUrl: "",
      lastInviteActivityMs: lastMs,
    });
  }

  return rows;
}

/** Invitations where the current user is instructor or learner (recruitment threads). */
export function useMessagingInvitations(uid: string | undefined) {
  const [invAsInstructor, setInvAsInstructor] = useState<Invitation[]>([]);
  const [invAsLearner, setInvAsLearner] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setInvAsInstructor([]);
      setInvAsLearner([]);
      setLoading(false);
      return;
    }
    const db = getFirestoreDb();
    const qInst = query(collection(db, "invitations"), where("instructorId", "==", uid));
    const qLearn = query(collection(db, "invitations"), where("learnerId", "==", uid));

    let firstInst = false;
    let firstLearn = false;
    const maybeDoneLoading = () => {
      if (firstInst && firstLearn) setLoading(false);
    };

    const unsub1 = onSnapshot(
      qInst,
      (snap) => {
        setInvAsInstructor(
          snap.docs.map((d) => parseInvitation(d.id, d.data() as Record<string, unknown>)),
        );
        setError(null);
        if (!firstInst) {
          firstInst = true;
          maybeDoneLoading();
        }
      },
      (e) => {
        setError(e instanceof Error ? e.message : "Could not load conversations.");
        if (!firstInst) {
          firstInst = true;
          maybeDoneLoading();
        }
      },
    );

    const unsub2 = onSnapshot(
      qLearn,
      (snap) => {
        setInvAsLearner(
          snap.docs.map((d) => parseInvitation(d.id, d.data() as Record<string, unknown>)),
        );
        setError(null);
        if (!firstLearn) {
          firstLearn = true;
          maybeDoneLoading();
        }
      },
      (e) => {
        setError(e instanceof Error ? e.message : "Could not load conversations.");
        if (!firstLearn) {
          firstLearn = true;
          maybeDoneLoading();
        }
      },
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [uid]);

  const invitationsMerged = useMemo(() => {
    const byId = new Map<string, Invitation>();
    for (const inv of invAsInstructor) byId.set(inv.id, inv);
    for (const inv of invAsLearner) byId.set(inv.id, inv);
    return [...byId.values()];
  }, [invAsInstructor, invAsLearner]);

  const conversations = useMemo(() => {
    if (!uid) return [];
    return mergeInvitationsToConversations(uid, invitationsMerged);
  }, [uid, invitationsMerged]);

  return { conversations, loading, error };
}

export type OtherProfile = { avatarUrl: string; fullName: string };

/** Loads avatar + display name for the counterparty (learners in `users`, instructors in `instructors`). */
export function useOtherUserProfiles(
  conversations: MessagingConversation[],
  myRole: UserRole | undefined,
) {
  const [byId, setById] = useState<Record<string, OtherProfile>>({});

  useEffect(() => {
    if (!myRole || !conversations.length) {
      setById({});
      return;
    }
    let cancelled = false;
    const db = getFirestoreDb();
    const collectionName = myRole === "instructor" ? "users" : "instructors";

    void (async () => {
      const next: Record<string, OtherProfile> = {};
      const ids = [...new Set(conversations.map((c) => c.otherUserId))];
      await Promise.all(
        ids.map(async (id) => {
          try {
            const snap = await getDoc(doc(db, collectionName, id));
            if (!snap.exists()) return;
            const data = snap.data() as Record<string, unknown>;
            const fullName = String(data.fullName ?? "").trim();
            const avatarUrl = String(data.avatarUrl ?? "");
            next[id] = { fullName, avatarUrl };
          } catch {
            /* ignore */
          }
        }),
      );
      if (!cancelled) setById(next);
    })();

    return () => {
      cancelled = true;
    };
  }, [conversations, myRole]);

  return byId;
}

export type LastChatPreview = { text: string; atMs: number; senderId: string };

export function useChatLastMessagePreviews(chatIds: string[]) {
  const [byChat, setByChat] = useState<Record<string, LastChatPreview>>({});
  const key = useMemo(() => [...chatIds].sort().join("|"), [chatIds]);

  useEffect(() => {
    const ids = key ? key.split("|") : [];
    if (!ids.length) {
      setByChat({});
      return;
    }
    setByChat({});
    const db = getFirestoreDb();
    const unsubs = ids.map((chatId) => {
      const qLast = query(
        collection(db, "messages", chatId, "messages"),
        orderBy("createdAt", "desc"),
        limit(1),
      );
      return onSnapshot(qLast, (snap) => {
        const doc0 = snap.docs[0];
        setByChat((prev) => {
          const copy = { ...prev };
          if (!doc0) {
            delete copy[chatId];
            return copy;
          }
          const data = doc0.data() as Record<string, unknown>;
          copy[chatId] = {
            text: String(data.text ?? ""),
            atMs: tsToMillis(data.createdAt),
            senderId: String(data.senderId ?? ""),
          };
          return copy;
        });
      });
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [key]);

  return byChat;
}

export function useChatThread(chatId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(Boolean(chatId));

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const db = getFirestoreDb();
    const qThread = query(
      collection(db, "messages", chatId, "messages"),
      orderBy("createdAt", "asc"),
    );
    const unsub = onSnapshot(
      qThread,
      (snap) => {
        setMessages(
          snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              senderId: String(data.senderId ?? ""),
              text: String(data.text ?? ""),
              createdAt: data.createdAt as ChatMessage["createdAt"],
            };
          }),
        );
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [chatId]);

  return { messages, loading };
}

export async function sendChatMessage(
  chatId: string,
  senderId: string,
  text: string,
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;
  const db = getFirestoreDb();
  await addDoc(collection(db, "messages", chatId, "messages"), {
    senderId,
    text: trimmed,
    createdAt: serverTimestamp(),
  });
}

/**
 * Learner starts (or continues) a DM with an instructor from the directory.
 * Creates an invitation row on first contact so the thread appears in Messages; then stores the message.
 */
export async function ensureLearnerInstructorThread(params: {
  learnerId: string;
  learnerName: string;
  instructorId: string;
  instructorName: string;
  message: string;
}): Promise<string> {
  const { learnerId, learnerName, instructorId, instructorName, message } = params;
  const text = message.trim();
  if (!text) throw new Error("Message cannot be empty");

  const db = getFirestoreDb();
  const chatId = chatIdForUserPair(learnerId, instructorId);

  const qLearn = query(collection(db, "invitations"), where("learnerId", "==", learnerId));
  const snap = await getDocs(qLearn);
  let hasPair = false;
  for (const d of snap.docs) {
    const data = d.data() as Record<string, unknown>;
    if (
      String(data.instructorId ?? "") === instructorId &&
      String(data.learnerId ?? "") === learnerId
    ) {
      hasPair = true;
      break;
    }
  }

  const batch = writeBatch(db);
  if (!hasPair) {
    const invRef = doc(collection(db, "invitations"));
    batch.set(invRef, {
      instructorId,
      instructorName,
      learnerId,
      learnerName,
      reelId: DIRECT_INSTRUCTOR_DM_REEL_ID,
      message: text,
      status: "accepted",
      createdAt: serverTimestamp(),
    });
  }
  const msgRef = doc(collection(db, "messages", chatId, "messages"));
  batch.set(msgRef, {
    senderId: learnerId,
    text,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return chatId;
}
