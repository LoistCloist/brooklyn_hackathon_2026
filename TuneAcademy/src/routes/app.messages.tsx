import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { MessagesScreen } from "@/components/tuneacademy/MessagesScreen";
import { useAuth } from "@/contexts/AuthContext";

export const Route = createFileRoute("/app/messages")({
  head: () => ({ meta: [{ title: "Messages — TuneAcademy" }] }),
  component: MessagesTab,
});

function MessagesTab() {
  const { userDoc } = useAuth();
  const isInstructor = userDoc?.role === "instructor";

  return (
    <AppShell>
      <header className="pt-8">
        <h1 className="text-3xl font-black tracking-tight text-[#fffdf5]">Messages</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-[#e8f4df]/70">
          {isInstructor
            ? "Chat with learners you work with. Threads from MusiReels recruitment show up here for you and the learner."
            : "Chat with instructors who reach out. Recruitment messages and replies appear in the same thread."}
        </p>
      </header>

      <MessagesScreen />
    </AppShell>
  );
}
