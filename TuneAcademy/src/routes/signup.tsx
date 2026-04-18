import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Pill } from "@/components/musilearn/Pill";
import { formatAuthError } from "@/lib/authMessages";
import { getFirebaseAuth } from "@/lib/firebase";
import { createUserFirestoreDoc } from "@/lib/musilearnFirestore";
import { brandTheme, musicImages } from "@/lib/theme";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { useState } from "react";
import { ArrowLeft, Music2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

type Search = { role?: "learner" | "instructor" };

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    role: s.role === "instructor" ? "instructor" : "learner",
  }),
  head: () => ({ meta: [{ title: "Sign up - TuneAcademy" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { role = "learner" } = Route.useSearch();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fullName = name.trim();
    const mail = email.trim();
    if (!fullName || !mail) {
      toast.error("Enter your name and email.");
      return;
    }
    if (pw.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (pw !== pw2) {
      toast.error("Passwords do not match.");
      return;
    }

    setBusy(true);
    const auth = getFirebaseAuth();
    try {
      const cred = await createUserWithEmailAndPassword(auth, mail, pw);
      try {
        await createUserFirestoreDoc(cred.user.uid, {
          role,
          fullName,
          email: mail,
        });
      } catch (firestoreErr) {
        try {
          await deleteUser(cred.user);
        } catch {
          /* best effort */
        }
        toast.error(formatAuthError(firestoreErr));
        return;
      }

      toast.success("Account created");
      if (role === "instructor") nav({ to: "/onboarding", replace: true });
      else nav({ to: "/app", replace: true });
    } catch (err) {
      toast.error(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  const isInstructor = role === "instructor";

  return (
    <div className={`relative min-h-screen overflow-hidden ${brandTheme.page}`}>
      <img
        src={musicImages.studio}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(8,18,14,0.98)_0%,rgba(8,18,14,0.82)_52%,rgba(8,18,14,0.46)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(255,214,102,0.25),transparent_30%),radial-gradient(circle_at_17%_82%,rgba(47,197,181,0.24),transparent_31%),radial-gradient(circle_at_82%_84%,rgba(255,88,88,0.14),transparent_25%)]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(380px,460px)] lg:px-10">
        <section className="hidden lg:block">
          <Link to="/" className={`text-sm font-black uppercase tracking-[0.24em] ${brandTheme.ink}`}>
            TuneAcademy
          </Link>
          <motion.div
            className="mt-20 max-w-2xl"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className={`inline-flex rounded-lg border border-[#ffd666]/40 bg-[#0b1510]/45 px-3 py-2 text-xs font-bold uppercase tracking-[0.22em] ${brandTheme.gold} backdrop-blur`}>
              {isInstructor ? "Build your studio roster" : "Start with a sharper target"}
            </p>
            <h1 className={`mt-5 text-6xl font-black leading-[0.9] tracking-normal ${brandTheme.ink}`}>
              {isInstructor ? "Turn feedback into better students." : "Make every practice take count."}
            </h1>
            <p className={`mt-6 max-w-xl text-lg leading-8 ${brandTheme.inkSoft}`}>
              {isInstructor
                ? "Show up for musicians whose goals match the way you teach."
                : "Record, learn what is holding you back, and find an instructor for the exact gap."}
            </p>
          </motion.div>
        </section>

        <motion.section
          className={`w-full rounded-lg p-5 sm:p-6 ${brandTheme.glass}`}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#fffdf5]/25 bg-[#fffdf5]/8 transition hover:bg-[#fffdf5] hover:text-[#0b1510]"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#ffd666] text-[#11140c]">
              {isInstructor ? <Sparkles className="h-5 w-5" /> : <Music2 className="h-5 w-5" />}
            </div>
          </div>

          <div className="mt-8">
            <p className={`text-xs font-black uppercase tracking-[0.22em] ${brandTheme.teal}`}>
              Create account
            </p>
            <h1 className={`mt-3 text-4xl font-black tracking-normal ${brandTheme.ink}`}>
              {isInstructor ? "Teach on TuneAcademy" : "Start learning"}
            </h1>
            <p className={`mt-2 text-sm leading-6 ${brandTheme.inkSoft}`}>
              {isInstructor
                ? "Set up an instructor profile after signup."
                : "Create your learner profile and get to your first analysis."}
            </p>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg border border-[#fffdf5]/15 bg-[#0b1510]/35 p-1">
            <RoleLink active={!isInstructor} role="learner">
              Learner
            </RoleLink>
            <RoleLink active={isInstructor} role="instructor">
              Instructor
            </RoleLink>
          </div>

          <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-4">
            <Field label="Full name" value={name} onChange={setName} type="text" autoComplete="name" />
            <Field label="Email" value={email} onChange={setEmail} type="email" autoComplete="email" />
            <Field
              label="Password"
              value={pw}
              onChange={setPw}
              type="password"
              autoComplete="new-password"
            />
            <Field
              label="Confirm password"
              value={pw2}
              onChange={setPw2}
              type="password"
              autoComplete="new-password"
            />
            <Pill
              type="submit"
              size="lg"
              className={`mt-3 w-full ${brandTheme.primaryButton}`}
              disabled={busy}
            >
              {busy ? "Creating account..." : isInstructor ? "Continue as instructor" : "Continue as learner"}
            </Pill>
          </form>

          <p className="mt-8 text-center text-sm text-[#e8f4df]/70">
            Already have an account?{" "}
            <Link to="/login" className="font-semibold text-[#ffd666] underline underline-offset-4">
              Log in
            </Link>
          </p>
        </motion.section>
      </div>
    </div>
  );
}

function RoleLink({
  active,
  role,
  children,
}: {
  active: boolean;
  role: "learner" | "instructor";
  children: React.ReactNode;
}) {
  return (
    <Link
      to="/signup"
      search={{ role }}
      className={
        active
          ? "rounded-lg bg-[#ffd666] px-3 py-2 text-center text-sm font-black text-[#11140c]"
          : "rounded-lg px-3 py-2 text-center text-sm font-semibold text-[#e8f4df]/75 transition hover:bg-[#fffdf5]/10 hover:text-[#fffdf5]"
      }
    >
      {children}
    </Link>
  );
}

function Field({
  label,
  value,
  onChange,
  type,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[#e8f4df]/70">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className={`h-12 w-full px-4 text-base ${brandTheme.input}`}
      />
    </label>
  );
}
