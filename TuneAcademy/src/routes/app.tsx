import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { AppNav } from "@/components/tuneacademy/AppNav";
import { ChatbotFab } from "@/components/tuneacademy/ChatbotFab";
import { useAuth } from "@/contexts/AuthContext";
import { getInstructorDoc, instructorOnboardingComplete } from "@/lib/tuneacademyFirestore";
import { useEffect, useState } from "react";
import { Pill } from "@/components/tuneacademy/Pill";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
   const nav = useNavigate();
   const { user, userDoc, loading, signOutUser } = useAuth();
   const [instructorCheck, setInstructorCheck] = useState<"pending" | "ready">("pending");
   const bypassAuth = import.meta.env.VITE_BYPASS_AUTH === "true";

   useEffect(() => {
      if (bypassAuth) {
         setInstructorCheck("ready");
         return;
      }
      if (loading) return;
      if (!user) {
         void nav({ to: "/login", replace: true });
         return;
      }
      if (!userDoc) {
         setInstructorCheck("ready");
         return;
      }
      if (userDoc.role !== "instructor") {
         setInstructorCheck("ready");
         return;
      }
      void getInstructorDoc(user.uid).then((inst) => {
         if (instructorOnboardingComplete(inst)) setInstructorCheck("ready");
         else void nav({ to: "/onboarding", replace: true });
      });
   }, [bypassAuth, loading, user, userDoc, nav]);

   if (!bypassAuth && (loading || !user)) {
      return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading…</div>;
   }

   if (!bypassAuth && !userDoc) {
      return (
         <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
               Your account exists, but no TuneAcademy profile was found in Firestore. Sign out and sign up again, or check your Firebase
               project and network connection.
            </p>
            <Pill
               type="button"
               variant="secondary"
               className="border-red-500/50 bg-red-500/12 text-red-100 hover:bg-red-500/20 hover:text-red-50"
               onClick={() => void signOutUser()}
            >
               Sign out
            </Pill>
         </div>
      );
   }

   if (!bypassAuth && userDoc && userDoc.role === "instructor" && instructorCheck === "pending") {
      return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Loading…</div>;
   }

   return (
      <div className="min-h-screen bg-background text-foreground">
         <Outlet />
         <ChatbotFab />
         <AppNav />
      </div>
   );
}
