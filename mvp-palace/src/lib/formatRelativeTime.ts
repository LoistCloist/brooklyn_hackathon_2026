import { formatDistanceToNow } from "date-fns";
import type { Timestamp } from "firebase/firestore";

export function formatRelativeTime(ts: Timestamp): string {
  try {
    return formatDistanceToNow(ts.toDate(), { addSuffix: true });
  } catch {
    return "";
  }
}
