import { motion } from "framer-motion";

export function ScoreBar({ label, value, animate = false }: { label: string; value: number; animate?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-accent">
        <motion.div
          className="h-full rounded-full bg-foreground"
          initial={animate ? { width: 0 } : false}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          style={animate ? undefined : { width: `${value}%` }}
        />
      </div>
    </div>
  );
}
