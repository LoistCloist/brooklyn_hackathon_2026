import { motion } from "framer-motion";
import { Receipt } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfileSessionReceipts } from "@/hooks/useProfileSessionReceipts";
import { brandTheme } from "@/lib/theme";

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 2 });

export type ProfileReceiptsProps = {
   /** When set with `role`, loads receipts for that user (e.g. own public learner/instructor profile). */
   viewerUid?: string | null;
   viewerRole?: "learner" | "instructor" | null;
};

export function ProfileReceipts(props: ProfileReceiptsProps = {}) {
   const { user, userDoc } = useAuth();
   const uid = props.viewerUid ?? user?.uid ?? null;
   const role =
      props.viewerRole ??
      (userDoc?.role === "learner" ? "learner" : userDoc?.role === "instructor" ? "instructor" : null);

   const { receipts, counterpartyNames } = useProfileSessionReceipts(uid, role);

   if (!uid || !role) return null;

   const hasEstimatedAmounts = receipts.some((r) => !r.amountIsRecorded);

   return (
      <motion.section
         className="rounded-xl border border-[#fffdf5]/18 bg-[#0b1510]/70 p-6"
         initial={{ opacity: 0, y: 14 }}
         animate={{ opacity: 1, y: 0 }}
         transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
         <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
               <p className={`text-xs font-black uppercase tracking-[0.18em] ${brandTheme.teal}`}>Receipts</p>
               <h2 className="mt-2 text-xl font-black text-[#fffdf5]">
                  {role === "learner" ? "Payments made" : "Payments received"}
               </h2>
               <p className="mt-1 text-sm font-semibold text-[#e8f4df]/60">
                  {role === "learner"
                     ? "Each line appears after you and your instructor both open the Meet link for a scheduled session."
                     : "Each line appears after you and your student both open the Meet link for a scheduled session."}
               </p>
            </div>
            <Receipt className="h-9 w-9 shrink-0 text-[#ffd666]/85" aria-hidden />
         </div>

         {receipts.length === 0 ? (
            <p className="mt-6 rounded-lg border border-[#fffdf5]/10 bg-[#0b1510]/45 px-4 py-5 text-sm font-semibold text-[#e8f4df]/55">
               No completed sessions yet — finished lessons show here automatically.
            </p>
         ) : (
            <ul className="mt-5 space-y-3">
               {receipts.map((r) => {
                  const who = counterpartyNames[r.counterpartyId] ?? "…";
                  return (
                     <li
                        key={r.key}
                        className="rounded-lg border border-[#fffdf5]/10 bg-[#0b1510]/50 px-4 py-3 text-sm text-[#e8f4df]/80"
                     >
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                           <p className="font-bold text-[#fffdf5]">{`Lesson with ${who}`}</p>
                           <p className="tabular-nums text-base font-black text-[#ffd666]">{money.format(r.amountUsd)}</p>
                        </div>
                        <p className="mt-1 text-xs text-[#e8f4df]/50">
                           Scheduled:{" "}
                           {r.sessionStart.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}{" "}
                           – {r.sessionEnd.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </p>
                        <p className="mt-0.5 text-xs text-[#e8f4df]/50">
                           Completed: {r.completedAt.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                        </p>
                     </li>
                  );
               })}
            </ul>
         )}

         {hasEstimatedAmounts && receipts.length > 0 ? (
            <p className="mt-4 text-xs text-[#e8f4df]/45">
               Some amounts were estimated from the tutor&apos;s current hourly rate; new sessions store the exact charge automatically.
            </p>
         ) : null}
      </motion.section>
   );
}
