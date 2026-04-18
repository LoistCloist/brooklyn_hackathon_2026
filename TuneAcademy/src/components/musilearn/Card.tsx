import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-xl border border-hairline bg-surface text-surface-foreground shadow-card",
        className,
      )}
      {...rest}
    />
  );
}
