import { createFileRoute, Navigate } from "@tanstack/react-router";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { StudentsDirectory } from "@/components/tuneacademy/StudentsDirectory";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/app/students")({
  head: () => ({ meta: [{ title: "Students — TuneAcademy" }] }),
  component: StudentsTab,
});

function StudentsTab() {
  const { userDoc, loading } = useAuth();

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[45vh] items-center justify-center text-sm font-semibold text-[#e8f4df]/55">
          Loading…
        </div>
      </AppShell>
    );
  }

  if (userDoc?.role !== "instructor") {
    return <Navigate to="/app" replace />;
  }

  return (
    <AppShell>
      <StudentsDirectory />
    </AppShell>
  );
}
