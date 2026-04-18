import { ReactNode } from "react";

export function AppShell({ children, padBottom = true }: { children: ReactNode; padBottom?: boolean }) {
  return (
    <div className="min-h-screen w-full bg-[#0b1510] text-[#fffdf5]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_82%_10%,rgba(255,214,102,0.18),transparent_28%),radial-gradient(circle_at_14%_80%,rgba(47,197,181,0.16),transparent_30%)]" />
      <div className={"relative mx-auto w-full max-w-7xl px-6 pt-24 lg:px-10 " + (padBottom ? "pb-12" : "")}>{children}</div>
    </div>
  );
}
