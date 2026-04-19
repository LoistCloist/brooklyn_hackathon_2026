import { cn } from "@/lib/utils";

export function Avatar({
  initials,
  src,
  size = 40,
  className,
}: {
  initials: string;
  src?: string;
  size?: number;
  className?: string;
}) {
  const url = src?.trim();
  if (url) {
    return (
      <div
        className={cn(
          "flex shrink-0 overflow-hidden rounded-full border border-hairline bg-accent",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <img src={url} alt="" className="h-full w-full object-cover rounded-[inherit]" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-hairline bg-accent font-semibold tracking-tight",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}
