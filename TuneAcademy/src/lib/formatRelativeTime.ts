import { formatDistanceToNow } from "date-fns";
import { firestoreLikeToMillis } from "@/lib/firestoreTime";

export function formatRelativeTime(ts: unknown): string {
  const ms = firestoreLikeToMillis(ts);
  if (ms == null) return "";
  try {
    return formatDistanceToNow(new Date(ms), { addSuffix: true });
  } catch {
    return "";
  }
}
