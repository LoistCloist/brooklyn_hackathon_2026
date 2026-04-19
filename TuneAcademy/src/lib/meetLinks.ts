/**
 * Demo Google Meet–style links. Production should create a real meeting space
 * via the Meet REST API (see `src/GoogleMeet.md`) from a trusted backend using
 * a Workspace service account, then store the returned `meetingUri`.
 */

function hash32(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Deterministic fake meeting code (abc-defgh-ijk style) for stable URLs per session. */
export function demoMeetCodeForSession(engagementId: string, sessionIndex: number): string {
  const seed = `${engagementId}:${sessionIndex}`;
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let h = hash32(seed);
  const parts: string[] = [];
  const lens = [3, 4, 3];
  for (let p = 0; p < lens.length; p++) {
    let chunk = "";
    const len = lens[p] ?? 3;
    for (let i = 0; i < len; i++) {
      h = (Math.imul(h, 1103515245) + 12345) >>> 0;
      chunk += alphabet[h % alphabet.length]!;
    }
    parts.push(chunk);
  }
  return `${parts[0]}-${parts[1]}-${parts[2]}`;
}

export function demoMeetUri(engagementId: string, sessionIndex: number): string {
  return `https://meet.google.com/${demoMeetCodeForSession(engagementId, sessionIndex)}`;
}
