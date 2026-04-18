import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { MessagesScreen } from "@/components/tuneacademy/MessagesScreen";
import { useAuth } from "@/contexts/AuthContext";

type Search = { chat?: string };

export const Route = createFileRoute("/app/messages")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    chat: typeof s.chat === "string" && s.chat.length > 0 ? s.chat : undefined,
  }),
  head: () => ({ meta: [{ title: "Messages — TuneAcademy" }] }),
  component: MessagesTab,
});

function MessagesTab() {
  const { userDoc } = useAuth();
  const isInstructor = userDoc?.role === "instructor";
  const { chat } = Route.useSearch();

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

      <MessagesScreen initialChatId={chat} />
    </AppShell>
  );
}
