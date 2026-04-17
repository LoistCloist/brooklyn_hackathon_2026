import { createFileRoute, Link } from "@tanstack/react-router";
import { Pill } from "@/components/musilearn/Pill";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MusiLearn — AI-powered music instruction" },
      {
        name: "description",
        content:
          "MusiLearn is an AI-powered, two-sided music instruction marketplace. Get a weakness profile, find the right teacher.",
      },
      { property: "og:title", content: "MusiLearn — AI-powered music instruction" },
      {
        property: "og:description",
        content: "Record. Analyze. Learn. Find the instructor that matches your weaknesses.",
      },
    ],
  }),
  component: Welcome,
});

function Welcome() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
        <div className="absolute -top-24 left-1/2 h-[60vh] w-[120vw] -translate-x-1/2 rounded-[50%] bg-foreground blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-between px-6 py-10">
        <div className="w-full pt-6">
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">MusiLearn · v1</p>
        </div>

        <motion.div
          className="flex flex-1 flex-col items-center justify-center text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        >
          <h1 className="text-[64px] font-extrabold leading-none tracking-tighter">
            Musi<span className="text-muted-foreground">Learn</span>
          </h1>
          <p className="mt-6 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
            Record yourself. Get an AI weakness profile. Match with the instructor who fixes it.
          </p>
        </motion.div>

        <motion.div
          className="flex w-full flex-col gap-3 pb-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Link to="/signup" search={{ role: "learner" }}>
            <Pill size="lg" className="w-full">
              I want to learn
            </Pill>
          </Link>
          <Link to="/signup" search={{ role: "instructor" }}>
            <Pill size="lg" variant="secondary" className="w-full">
              I want to teach
            </Pill>
          </Link>
          <Link
            to="/login"
            className="mt-2 text-center text-xs text-muted-foreground hover:text-foreground"
          >
            Already have an account? <span className="underline underline-offset-4">Log in</span>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
