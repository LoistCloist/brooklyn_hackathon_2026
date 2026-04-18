/** Normalize Firestore Timestamp, plain { seconds }, or millis into milliseconds. */
export function firestoreLikeToMillis(ts: unknown): number | null {
  if (ts == null) return null;
  if (typeof ts === "number" && Number.isFinite(ts)) return ts;

  if (typeof ts === "object" && ts !== null) {
    const o = ts as Record<string, unknown>;

    if (typeof o.toMillis === "function") {
      try {
        // Must preserve `this` (Firestore Timestamp methods are not free functions).
        const n = (o.toMillis as (this: typeof o) => number).call(o);
        return typeof n === "number" && Number.isFinite(n) ? n : null;
      } catch {
        /* fall through */
      }
    }

    if (typeof o.toDate === "function") {
      try {
        const d = (o.toDate as (this: typeof o) => Date).call(o);
        if (d instanceof Date && !Number.isNaN(d.getTime())) return d.getTime();
      } catch {
        /* fall through */
      }
    }

    const sec =
      typeof o.seconds === "number"
        ? o.seconds
        : typeof o._seconds === "number"
          ? o._seconds
          : null;
    if (sec != null && Number.isFinite(sec)) {
      const ns =
        typeof o.nanoseconds === "number"
          ? o.nanoseconds
          : typeof o._nanoseconds === "number"
            ? o._nanoseconds
            : 0;
      return sec * 1000 + (typeof ns === "number" && Number.isFinite(ns) ? ns / 1e6 : 0);
    }
  }

  return null;
}

export function firestoreLikeToMillisOrZero(ts: unknown): number {
  return firestoreLikeToMillis(ts) ?? 0;
}
