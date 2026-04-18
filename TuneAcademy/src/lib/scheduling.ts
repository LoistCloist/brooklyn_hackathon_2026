import type { Timestamp } from "firebase/firestore";

/** 0 = Sunday … 6 = Saturday (matches `Date#getDay()`). */
export type WeeklyTimeSlot = {
  weekday: number;
  startMinute: number;
  endMinute: number;
};

export function slotKey(s: WeeklyTimeSlot): string {
  return `${s.weekday}:${s.startMinute}:${s.endMinute}`;
}

export function weeklySlotsOverlap(a: WeeklyTimeSlot, b: WeeklyTimeSlot): boolean {
  if (a.weekday !== b.weekday) return false;
  return a.startMinute < b.endMinute && b.startMinute < a.endMinute;
}

export function dedupeWeeklySlots(slots: WeeklyTimeSlot[]): WeeklyTimeSlot[] {
  const seen = new Set<string>();
  const out: WeeklyTimeSlot[] = [];
  for (const s of slots) {
    const k = slotKey(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

export function hourBlock(weekday: number, hour: number): WeeklyTimeSlot {
  const startMinute = hour * 60;
  return { weekday, startMinute, endMinute: startMinute + 60 };
}

export function formatSlotLabel(slot: WeeklyTimeSlot): string {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const h = Math.floor(slot.startMinute / 60);
  const m = slot.startMinute % 60;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  const t = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${days[slot.weekday] ?? "?"} · ${t}`;
}

/** Each calendar week block starts the local day after `acceptAt` (midnight). */
export function materializeWeeklyMeetings(
  acceptAt: Date,
  weeks: number,
  slots: WeeklyTimeSlot[],
): { start: Date; end: Date }[] {
  const unique = dedupeWeeklySlots(slots);
  const seriesStart = new Date(acceptAt);
  seriesStart.setDate(seriesStart.getDate() + 1);
  seriesStart.setHours(0, 0, 0, 0);

  const out: { start: Date; end: Date }[] = [];
  for (let w = 0; w < weeks; w++) {
    const weekStart = new Date(seriesStart);
    weekStart.setDate(seriesStart.getDate() + w * 7);
    for (const slot of unique) {
      const day = new Date(weekStart);
      const delta = (slot.weekday - day.getDay() + 7) % 7;
      day.setDate(weekStart.getDate() + delta);
      const start = new Date(day);
      start.setHours(Math.floor(slot.startMinute / 60), slot.startMinute % 60, 0, 0);
      const end = new Date(day);
      end.setHours(Math.floor(slot.endMinute / 60), slot.endMinute % 60, 0, 0);
      if (start.getTime() > acceptAt.getTime()) {
        out.push({ start, end });
      }
    }
  }
  out.sort((a, b) => a.start.getTime() - b.start.getTime());
  return out;
}

export function timestampToMillis(ts: Timestamp | { seconds: number } | undefined): number | null {
  if (!ts) return null;
  if ("toMillis" in ts && typeof ts.toMillis === "function") return ts.toMillis();
  if ("seconds" in ts && typeof ts.seconds === "number") return ts.seconds * 1000;
  return null;
}

export function meetingsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function isEngagementActive(
  meetings: { startAt: Timestamp | { seconds: number }; endAt: Timestamp | { seconds: number } }[],
  now = Date.now(),
): boolean {
  if (!meetings.length) return false;
  const last = meetings[meetings.length - 1];
  const end = timestampToMillis(last.endAt);
  return end != null && end > now;
}

/** Remove weekly template slots that collide with any busy recurring hold. */
export function subtractRecurringHolds(
  openSlots: WeeklyTimeSlot[],
  busyHolds: WeeklyTimeSlot[],
): WeeklyTimeSlot[] {
  return openSlots.filter(
    (slot) => !busyHolds.some((busy) => weeklySlotsOverlap(slot, busy)),
  );
}

export function flattenEngagementHolds(
  engagements: { weeklySlots: WeeklyTimeSlot[]; meetings: unknown[] }[],
  now = Date.now(),
): WeeklyTimeSlot[] {
  const holds: WeeklyTimeSlot[] = [];
  for (const e of engagements) {
    if (!isEngagementActive(e.meetings as never, now)) continue;
    holds.push(...e.weeklySlots);
  }
  return dedupeWeeklySlots(holds);
}
