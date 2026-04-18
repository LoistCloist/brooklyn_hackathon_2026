/** Matches recruitment / Firestore rules: sorted user ids joined by `_`. */
export function chatIdForUserPair(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join("_");
}

/** Inverse of {@link chatIdForUserPair} for standard Firebase UIDs (no `_` in id). */
export function otherUserIdFromChatId(chatId: string, myUid: string): string | null {
  const parts = chatId.split("_");
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  if (a === myUid) return b ?? null;
  if (b === myUid) return a ?? null;
  return null;
}

/** Sentinel reel id for learner→instructor threads started from the instructor directory (not MusiReels). */
export const DIRECT_INSTRUCTOR_DM_REEL_ID = "__instructor_directory__";

/** Sentinel reel id for learner↔learner DMs (invitation rows reuse instructorId/learnerId as sorted uid slots). */
export const LEARNER_PEER_DM_REEL_ID = "__learner_peer__";
