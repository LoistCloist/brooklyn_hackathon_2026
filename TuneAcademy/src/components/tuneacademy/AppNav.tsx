import { Link, useLocation } from "@tanstack/react-router";
import { GraduationCap, Home, MessageSquareText, Mic, PlayCircle, UserCircle, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUnreadDot } from "@/hooks/useMessaging";
import { cn } from "@/lib/utils";

const learnerNavTabs = [
   { to: "/app", label: "Home", icon: Home, exact: true },
   { to: "/app/musireels", label: "Riffs", icon: PlayCircle },
   { to: "/app/instructors", label: "Instructors", icon: Users },
   { to: "/app/messages", label: "Messages", icon: MessageSquareText },
   { to: "/app/analyze", label: "Analyze", icon: Mic },
   { to: "/app/profile", label: "Profile", icon: UserCircle },
];

const instructorNavTabs = [
   { to: "/app", label: "Home", icon: Home, exact: true },
   { to: "/app/musireels", label: "Riffs", icon: PlayCircle },
   { to: "/app/students", label: "Students", icon: GraduationCap },
   { to: "/app/messages", label: "Messages", icon: MessageSquareText },
   { to: "/app/profile", label: "Profile", icon: UserCircle },
];

export function AppNav() {
   const { pathname } = useLocation();
   const { user, userDoc } = useAuth();
   const hasUnread = useUnreadDot(user?.uid);
   const tabs = userDoc?.role === "instructor" ? instructorNavTabs : learnerNavTabs;
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
                  const isMessages = t.to === "/app/messages";
                  return (
                     <Link
                        key={t.to}
                        to={t.to}
                        className={cn(
                           "flex min-w-32 items-center justify-center gap-2 rounded-lg px-4 py-3 text-xs font-bold uppercase tracking-wide transition-colors",
                           active ? "bg-[#fffdf5]/8 text-[#ffd666]" : "text-[#e8f4df]/55 hover:bg-[#fffdf5]/6 hover:text-[#fffdf5]",
                        )}
                     >
                        <span className="relative">
                           <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 1.8} />
                           {isMessages && hasUnread && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#ffd666]" />}
                        </span>
                        <span>{t.label}</span>
                     </Link>
                  );
               })}
            </div>
         </div>
      </nav>
   );
}
