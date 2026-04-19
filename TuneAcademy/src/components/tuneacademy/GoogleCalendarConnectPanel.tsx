import { useEffect, useState } from "react";
import { CalendarCheck, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createGoogleCalendarAuthUrl, getGoogleCalendarConnectionStatus, type GoogleCalendarConnectionStatus } from "@/lib/googleCalendar";
import { toast } from "sonner";

export function GoogleCalendarConnectPanel() {
   const [status, setStatus] = useState<GoogleCalendarConnectionStatus | null>(null);
   const [loading, setLoading] = useState(true);
   const [connecting, setConnecting] = useState(false);

   useEffect(() => {
      let cancelled = false;
      setLoading(true);
      void getGoogleCalendarConnectionStatus()
         .then((nextStatus) => {
            if (!cancelled) setStatus(nextStatus);
         })
         .catch(() => {
            if (!cancelled) setStatus({ connected: false, googleEmail: "" });
         })
         .finally(() => {
            if (!cancelled) setLoading(false);
         });
      return () => {
         cancelled = true;
      };
   }, []);

   async function connectCalendar() {
      setConnecting(true);
      try {
         const url = await createGoogleCalendarAuthUrl();
         window.location.href = url;
      } catch (error) {
         toast.error(error instanceof Error ? error.message : "Could not start Google Calendar connection.");
         setConnecting(false);
      }
   }

   const connected = status?.connected;

   return (
      <div className="mt-5 rounded-xl border border-[#ffd666]/25 bg-[#ffd666]/8 p-4">
         <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
               <CalendarCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#ffd666]" aria-hidden />
               <div className="min-w-0">
                  <p className="text-sm font-black text-[#fffdf5]">Google Calendar</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#e8f4df]/65">
                     {connected
                        ? `Connected${status.googleEmail ? ` as ${status.googleEmail}` : ""}. Accepted sessions can create real Google Meet links.`
                        : "Connect your teaching calendar so accepted sessions can create real Google Meet links."}
                  </p>
               </div>
            </div>
            <Button
               type="button"
               size="sm"
               className="shrink-0 bg-[#ffd666] text-[#11140c] hover:bg-[#ffd666]/90"
               disabled={loading || connecting}
               onClick={() => void connectCalendar()}
            >
               {loading || connecting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-1.5 h-4 w-4" />}
               {connected ? "Reconnect" : "Connect"}
            </Button>
         </div>
      </div>
   );
}
