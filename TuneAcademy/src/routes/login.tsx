import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Pill } from "@/components/musilearn/Pill";
import { useAuth } from "@/contexts/AuthContext";
import { formatAuthError } from "@/lib/authMessages";
import { getFirebaseAuth } from "@/lib/firebase";
import { resolvePostLoginPath } from "@/lib/musilearnFirestore";
import { brandTheme, musicImages } from "@/lib/theme";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { useEffect, useState } from "react";
import { ArrowLeft, Music2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in - TuneAcademy" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    void resolvePostLoginPath(user.uid).then((path) => nav({ to: path, replace: true }));
  }, [loading, user, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const auth = getFirebaseAuth();
      await signInWithEmailAndPassword(auth, email.trim(), pw);
      const path = await resolvePostLoginPath(auth.currentUser!.uid);
      toast.success("Welcome back");
      nav({ to: path, replace: true });
    } catch (err) {
      toast.error(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error("Enter your email above first.");
      return;
    }
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), trimmed);
      toast.success("Password reset email sent.");
    } catch (err) {
      toast.error(formatAuthError(err));
    }
  }

  if (!loading && user) {
    return (
      <div className={`flex min-h-screen items-center justify-center text-sm ${brandTheme.page}`}>
        Redirecting...
      </div>
    );
  }

  return (
    <div className={`relative min-h-screen overflow-hidden ${brandTheme.page}`}>
      <img
        src={musicImages.studio}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(8,18,14,0.97)_0%,rgba(8,18,14,0.82)_50%,rgba(8,18,14,0.48)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_18%,rgba(255,214,102,0.24),transparent_28%),radial-gradient(circle_at_20%_82%,rgba(47,197,181,0.22),transparent_30%)]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl items-center gap-10 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,440px)] lg:px-10">
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
              Back to the studio
            </p>
            <h1 className={`mt-5 text-6xl font-black leading-[0.9] tracking-normal ${brandTheme.ink}`}>
              Pick up where the last take left off.
            </h1>
            <p className={`mt-6 max-w-xl text-lg leading-8 ${brandTheme.inkSoft}`}>
              Your practice notes, instructor matches, and AI feedback are ready when you are.
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
              <Music2 className="h-5 w-5" />
            </div>
          </div>

          <div className="mt-9">
            <p className={`text-xs font-black uppercase tracking-[0.22em] ${brandTheme.teal}`}>
              Member access
            </p>
            <h1 className={`mt-3 text-4xl font-black tracking-normal ${brandTheme.ink}`}>
              Welcome back
            </h1>
            <p className={`mt-2 text-sm leading-6 ${brandTheme.inkSoft}`}>
              Log in to review your next practice target.
            </p>
          </div>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <LoginField
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
            />
            <LoginField
              label="Password"
              type="password"
              autoComplete="current-password"
              value={pw}
              onChange={setPw}
            />
            <button
              type="button"
              onClick={() => void forgot()}
              className="text-sm font-semibold text-[#e8f4df]/70 transition hover:text-[#ffd666]"
            >
              Forgot password?
            </button>
            <Pill
              type="submit"
              size="lg"
              className={`mt-3 w-full ${brandTheme.primaryButton}`}
              disabled={busy}
            >
              {busy ? "Signing in..." : "Log in"}
            </Pill>
          </form>

          <p className="mt-8 text-center text-sm text-[#e8f4df]/70">
            New here?{" "}
            <Link to="/" className="font-semibold text-[#ffd666] underline underline-offset-4">
              Get started
            </Link>
          </p>
        </motion.section>
      </div>
    </div>
  );
}

function LoginField({
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
        className={`h-13 w-full px-4 text-base ${brandTheme.input}`}
      />
    </label>
  );
}
