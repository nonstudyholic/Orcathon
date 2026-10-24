"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export default function AuthForm({
  initialMode,
  initialError,
}: {
  initialMode: Mode;
  initialError?: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        // Email confirmation is off: the user is already signed in.
        router.push("/dashboard");
        router.refresh();
        return;
      } else {
        setNotice("Check your inbox and click the confirmation link to finish signing up.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
      } else {
        router.push("/dashboard");
        router.refresh();
        return;
      }
    }
    setLoading(false);
  }

  const isSignup = mode === "signup";

  return (
    <div className="card p-6">
      <h1 className="text-xl font-semibold tracking-tight">
        {isSignup ? "Create your account" : "Log in to your account"}
      </h1>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {isSignup && <p className="mt-1 text-xs text-muted">Use at least 6 characters.</p>}
        </div>

        {error && (
          <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-md bg-accent/10 px-3 py-2 text-sm">
            {notice}
          </p>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Please wait..." : isSignup ? "Create account" : "Log in"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        {isSignup ? "Already have an account?" : "New here?"}{" "}
        <button
          type="button"
          className="font-medium text-accent underline-offset-4 hover:underline"
          onClick={() => {
            setMode(isSignup ? "login" : "signup");
            setError(null);
            setNotice(null);
          }}
        >
          {isSignup ? "Log in" : "Create an account"}
        </button>
      </p>
    </div>
  );
}
