/** Matches recruitment / Firestore rules: sorted user ids joined by `_`. */
export function chatIdForUserPair(userIdA: string, userIdB: string): string {
  return [userIdA, userIdB].sort().join("_");
}
