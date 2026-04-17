import { cn } from "@/lib/utils";

export function Avatar({ initials, size = 40, className }: { initials: string; size?: number; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-hairline bg-accent font-semibold tracking-tight",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}
