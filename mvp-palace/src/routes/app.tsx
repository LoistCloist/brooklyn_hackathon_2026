import { createFileRoute, Outlet } from "@tanstack/react-router";
import { BottomTabs } from "@/components/musilearn/BottomTabs";
import { ChatbotFab } from "@/components/musilearn/ChatbotFab";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Outlet />
      <ChatbotFab />
      <BottomTabs />
    </div>
  );
}
