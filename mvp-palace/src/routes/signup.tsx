import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Pill } from "@/components/musilearn/Pill";
import { formatAuthError } from "@/lib/authMessages";
import { getFirebaseAuth } from "@/lib/firebase";
import { createUserFirestoreDoc } from "@/lib/musilearnFirestore";
import { createUserWithEmailAndPassword, deleteUser } from "firebase/auth";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Search = { role?: "learner" | "instructor" };

export const Route = createFileRoute("/signup")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    role: s.role === "instructor" ? "instructor" : "learner",
  }),
  head: () => ({ meta: [{ title: "Sign up — MusiLearn" }] }),
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

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <Link
        to="/"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <div className="mt-8">
        <span className="inline-block rounded-full border border-hairline px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
          {role === "instructor" ? "Instructor" : "Learner"}
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">It takes less than a minute.</p>
      </div>

      <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-3">
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
        <Pill type="submit" size="lg" className="mt-4 w-full" disabled={busy}>
          {busy ? "Creating account…" : "Continue"}
        </Pill>
      </form>

      <p className="mt-auto pt-8 text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="text-foreground underline underline-offset-4">
          Log in
        </Link>
      </p>
    </div>
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
      <span className="mb-1 block text-[11px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-sm text-foreground outline-none transition-colors focus:border-foreground"
      />
    </label>
  );
}
