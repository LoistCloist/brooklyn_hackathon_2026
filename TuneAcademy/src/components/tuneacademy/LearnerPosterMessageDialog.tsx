import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ensureLearnerToPosterThread } from "@/hooks/useMessaging";
import { findLeakageIssue, leakageGuardMessage } from "@/lib/leakageGuard";
import type { UserRole } from "@/lib/tuneacademyFirestore";

type Props = {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   learnerId: string;
   learnerName: string;
   posterId: string;
   posterName: string;
   posterRole: UserRole;
   onSent?: () => void;
};

export function LearnerPosterMessageDialog({
   open,
   onOpenChange,
   learnerId,
   learnerName,
   posterId,
   posterName,
   posterRole,
   onSent,
}: Props) {
   const nav = useNavigate();
   const [message, setMessage] = useState("");
   const [posting, setPosting] = useState(false);
   const leakageIssue = findLeakageIssue(message);

   useEffect(() => {
      if (open) {
         setMessage(`Hi ${posterName}, I saw your reel on Musireels and wanted to say hello!`);
      }
   }, [open, posterName]);

   const send = async () => {
      const text = message.trim();
      if (!text) return;
      const issue = findLeakageIssue(text);
      if (issue) {
         toast.error(`${issue} ${leakageGuardMessage}`);
         return;
      }
      setPosting(true);
      try {
         const chatId = await ensureLearnerToPosterThread({ learnerId, learnerName, posterId, posterName, posterRole, message: text });
         toast.success(`Message sent to ${posterName}`);
         onSent?.();
         onOpenChange(false);
         void nav({ to: "/app/messages", search: { chat: chatId } });
      } catch (e) {
         toast.error(e instanceof Error ? e.message : "Could not send message.");
      } finally {
         setPosting(false);
      }
   };

   return (
      <Dialog open={open} onOpenChange={(v) => !posting && onOpenChange(v)}>
         <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
               <DialogTitle>Message {posterName}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 text-sm">
               <div>
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Your message</p>
                  <Textarea
                     value={message}
                     onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                     maxLength={500}
                     className="min-h-[120px]"
                     disabled={posting}
                  />
                  {leakageIssue ? (
                     <p className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                        {leakageIssue} {leakageGuardMessage}
                     </p>
                  ) : (
                     <p className="mt-2 text-xs text-muted-foreground">
                        Contact details and outside payment links stay inside TuneAcademy.
                     </p>
                  )}
                  <p className="mt-1 text-right text-xs text-muted-foreground">{message.length} / 500</p>
               </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
               <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={posting}>
                  Cancel
               </Button>
               <Button type="button" onClick={() => void send()} disabled={posting || !message.trim() || Boolean(leakageIssue)}>
                  {posting ? "Sending…" : "Send"}
               </Button>
            </DialogFooter>
         </DialogContent>
      </Dialog>
   );
}
