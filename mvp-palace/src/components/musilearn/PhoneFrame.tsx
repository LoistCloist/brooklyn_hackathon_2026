import { ReactNode } from "react";

/**
 * Mobile-first container. Constrains width to a phone-like canvas on desktop,
 * full-bleed on mobile. Adds bottom padding to clear the bottom tab bar.
 */
export function PhoneFrame({ children, padBottom = true }: { children: ReactNode; padBottom?: boolean }) {
  return (
    <div className="min-h-screen w-full bg-background">
      <div className={"mx-auto w-full max-w-md " + (padBottom ? "pb-24" : "")}>{children}</div>
    </div>
  );
}
