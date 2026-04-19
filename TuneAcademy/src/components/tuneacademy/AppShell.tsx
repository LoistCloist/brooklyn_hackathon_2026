import { ReactNode } from "react";
import { motion } from "framer-motion";

const notes = ["A", "C#", "F", "G", "Bb", "D", "E"];

export function AppShell({ children, padBottom = true }: { children: ReactNode; padBottom?: boolean }) {
   return (
      <div className="relative min-h-screen w-full overflow-hidden bg-[#0b1510] text-[#fffdf5]">
         <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_82%_10%,rgba(255,214,102,0.18),transparent_28%),radial-gradient(circle_at_14%_80%,rgba(47,197,181,0.16),transparent_30%)]" />
         <div className="pointer-events-none fixed inset-x-0 top-28 hidden h-52 -rotate-6 border-y border-[#fffdf5]/10 opacity-45 lg:block">
            <div className="absolute left-0 top-1/4 h-px w-full bg-[#fffdf5]/10" />
            <div className="absolute left-0 top-1/2 h-px w-full bg-[#fffdf5]/10" />
            <div className="absolute left-0 top-3/4 h-px w-full bg-[#fffdf5]/10" />
            {notes.map((note, index) => (
               <motion.span
                  key={note}
                  className="absolute text-4xl font-black text-[#ffd666]"
                  style={{ left: `${10 + index * 13}%`, top: `${index % 2 === 0 ? 16 : 58}%` }}
                  animate={{ y: [0, -10, 0], rotate: [-4, 5, -4] }}
                  transition={{ duration: 4.5 + index * 0.3, repeat: Infinity, ease: "easeInOut" }}
               >
                  {note}
               </motion.span>
            ))}
         </div>
         <div className="pointer-events-none fixed inset-x-0 bottom-18 hidden h-40 rotate-[5deg] border-y border-[#a6eee3]/8 opacity-35 xl:block">
            <div className="absolute left-0 top-1/3 h-px w-full bg-[#a6eee3]/10" />
            <div className="absolute left-0 top-2/3 h-px w-full bg-[#a6eee3]/10" />
            {["1", "2", "3", "4"].map((beat, index) => (
               <motion.span
                  key={beat}
                  className="absolute text-3xl font-black text-[#a6eee3]"
                  style={{ left: `${22 + index * 17}%`, top: `${index % 2 === 0 ? 18 : 54}%` }}
                  animate={{ opacity: [0.35, 0.75, 0.35], y: [0, 8, 0] }}
                  transition={{ duration: 3.8 + index * 0.25, repeat: Infinity, ease: "easeInOut" }}
               >
                  {beat}
               </motion.span>
            ))}
         </div>
         <div className={"relative mx-auto w-full max-w-7xl px-6 pt-24 lg:px-10 " + (padBottom ? "pb-12" : "")}>{children}</div>
      </div>
   );
}
