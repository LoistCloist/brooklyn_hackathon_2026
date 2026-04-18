import { Link, useLocation } from "@tanstack/react-router";
import { Home, PlayCircle, Users, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/musireels", label: "Musireels", icon: PlayCircle },
  { to: "/app/instructors", label: "Instructors", icon: Users },
  { to: "/app/analyze", label: "Analyze", icon: Mic },
];

export function BottomTabs() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-hairline bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-md items-stretch justify-around px-2 pb-[max(env(safe-area-inset-bottom),0px)]">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <Link
              key={t.to}
              to={t.to}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-wide uppercase transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 1.8} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
