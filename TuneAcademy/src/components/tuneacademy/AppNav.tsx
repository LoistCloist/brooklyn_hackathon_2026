import { Link, useLocation } from "@tanstack/react-router";
import { Home, PlayCircle, Users, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/app", label: "Home", icon: Home, exact: true },
  { to: "/app/musireels", label: "Musireels", icon: PlayCircle },
  { to: "/app/instructors", label: "Instructors", icon: Users },
  { to: "/app/analyze", label: "Analyze", icon: Mic },
];

export function AppNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed inset-x-0 top-0 z-40 border-b border-[#fffdf5]/15 bg-[#0b1510]/86 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 lg:px-10">
        <Link to="/app" className="text-sm font-black uppercase tracking-[0.24em] text-[#fffdf5]">
          TuneAcademy
        </Link>
        <div className="flex items-center gap-2">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "flex min-w-32 items-center justify-center gap-2 rounded-lg px-4 py-3 text-xs font-bold uppercase tracking-wide transition-colors",
                  active
                    ? "bg-[#fffdf5]/8 text-[#ffd666]"
                    : "text-[#e8f4df]/55 hover:bg-[#fffdf5]/6 hover:text-[#fffdf5]",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 1.8} />
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
