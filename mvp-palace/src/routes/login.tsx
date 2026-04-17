import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Pill } from "@/components/musilearn/Pill";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Log in — MusiLearn" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-8">
      <Link to="/" className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline">
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <div className="mt-8">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Log in to continue.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          nav({ to: "/app" });
        }}
        className="mt-8 space-y-3"
      >
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-widest text-muted-foreground">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-sm outline-none focus:border-foreground"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] uppercase tracking-widest text-muted-foreground">Password</span>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="h-12 w-full rounded-xl border border-hairline bg-surface px-4 text-sm outline-none focus:border-foreground"
          />
        </label>
        <button type="button" className="text-xs text-muted-foreground hover:text-foreground">
          Forgot password?
        </button>
        <Pill type="submit" size="lg" className="mt-4 w-full">
          Log in
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
