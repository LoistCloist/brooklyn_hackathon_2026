import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { BottomTabs } from "@/components/musilearn/BottomTabs";
import { ChatbotFab } from "@/components/musilearn/ChatbotFab";
import { useAuth } from "@/contexts/AuthContext";
import { getInstructorDoc, instructorOnboardingComplete } from "@/lib/musilearnFirestore";
import { useEffect, useState } from "react";
import { Pill } from "@/components/musilearn/Pill";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const nav = useNavigate();
  const { user, userDoc, loading, signOutUser } = useAuth();
  const [instructorCheck, setInstructorCheck] = useState<"pending" | "ready">("pending");

  useEffect(() => {
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
  }, [loading, user, userDoc, nav]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!userDoc) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          Your account exists, but no MusiLearn profile was found in Firestore. Sign out and sign up
          again, or check your Firebase project and network connection.
        </p>
        <Pill type="button" variant="secondary" onClick={() => void signOutUser()}>
          Sign out
        </Pill>
      </div>
    );
  }

  if (userDoc.role === "instructor" && instructorCheck === "pending") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
      <ChatbotFab />
      <BottomTabs />
    </div>
  );
}
