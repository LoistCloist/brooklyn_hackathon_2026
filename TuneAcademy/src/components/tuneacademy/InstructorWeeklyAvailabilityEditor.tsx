import type { WeeklyTimeSlot } from "@/lib/scheduling";
import { hourBlock, slotKey } from "@/lib/scheduling";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 16 }, (_, i) => i + 6);

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Variant = "surface" | "studio";

type Props = {
  value: WeeklyTimeSlot[];
  onChange: (next: WeeklyTimeSlot[]) => void;
  variant?: Variant;
};

export function InstructorWeeklyAvailabilityEditor({ value, onChange, variant = "surface" }: Props) {
  const activeKeys = new Set(value.map(slotKey));

  function toggle(weekday: number, hour: number) {
    const slot = hourBlock(weekday, hour);
    const k = slotKey(slot);
    if (activeKeys.has(k)) {
      onChange(value.filter((s) => slotKey(s) !== k));
    } else {
      onChange([...value, slot]);
    }
  }

  const chipOff =
    variant === "studio"
      ? "border-[#fffdf5]/14 text-[#e8f4df]/55 hover:border-[#ffd666]/40 hover:text-[#fffdf5]"
      : "border-hairline text-muted-foreground hover:border-foreground/40 hover:text-foreground";
  const chipOn =
    variant === "studio"
      ? "border-[#ffd666]/60 bg-[#ffd666] text-[#11140c]"
      : "border-foreground bg-foreground text-background";

  return (
    <div className="space-y-3">
      {DAY_LABELS.map((label, weekday) => (
        <div key={label} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <span
            className={cn(
              "w-11 shrink-0 pt-1 text-[11px] font-black uppercase tracking-widest",
              variant === "studio" ? "text-[#e8f4df]/45" : "text-muted-foreground",
            )}
          >
            {label}
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
            {HOURS.map((h) => {
              const slot = hourBlock(weekday, h);
              const active = activeKeys.has(slotKey(slot));
              const labelH = new Date(2000, 0, 1, h).toLocaleTimeString(undefined, {
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => toggle(weekday, h)}
                  className={cn(
                    "rounded-lg border px-2 py-1 text-[10px] font-bold transition",
                    active ? chipOn : chipOff,
                  )}
                >
                  {labelH}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
