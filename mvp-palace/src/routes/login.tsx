import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Pill } from "@/components/musilearn/Pill";
import { useAuth } from "@/contexts/AuthContext";
import { formatAuthError } from "@/lib/authMessages";
import { getFirebaseAuth } from "@/lib/firebase";
import { resolvePostLoginPath } from "@/lib/musilearnFirestore";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — MusiLearn" }] }),
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
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <Link
        to="/"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <div className="mt-8">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log in to continue.</p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-3">
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-widest text-muted-foreground">
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-sm outline-none focus:border-foreground"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-widest text-muted-foreground">
            Password
          </span>
          <input
            type="password"
            autoComplete="current-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-sm outline-none focus:border-foreground"
          />
        </label>
        <button
          type="button"
          onClick={() => void forgot()}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Forgot password?
        </button>
        <Pill type="submit" size="lg" className="mt-4 w-full" disabled={busy}>
          {busy ? "Signing in…" : "Log in"}
        </Pill>
      </form>

      <p className="mt-auto pt-8 text-center text-xs text-muted-foreground">
        New here?{" "}
        <Link to="/" className="text-foreground underline underline-offset-4">
          Get started
        </Link>
      </p>
    </div>
  );
}
