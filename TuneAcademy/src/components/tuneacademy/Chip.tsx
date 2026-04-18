import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  weakness?: boolean;
};

export function Chip({ className, active, weakness, ...rest }: Props) {
  return (
    <button
      className={cn(
        "h-8 shrink-0 rounded-full border px-3 text-xs font-medium tracking-tight transition-colors",
        active
          ? "bg-foreground text-background border-foreground"
          : weakness
            ? "border-foreground text-foreground bg-transparent"
            : "border-hairline text-muted-foreground hover:text-foreground hover:border-foreground/60",
        className,
      )}
      {...rest}
    />
  );
}
