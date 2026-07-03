"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoadingButton } from "@/components/loading-button";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const stale = params.get("stale") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    stale
      ? "Your session expired because the account no longer exists. Please sign in again."
      : null
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (!res || res.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg-subtle px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm"
      >
        <h1 className="text-2xl font-semibold text-fg">SimpleBookkeeping</h1>
        <p className="mt-1 text-sm text-fg-muted">Sign in to your account.</p>

        <label className="mt-6 block text-sm font-medium text-fg" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-fg outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />

        <label className="mt-4 block text-sm font-medium text-fg" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-fg outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
        />

        {error && (
          <p className="mt-4 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <LoadingButton
          type="submit"
          loading={loading}
          loadingLabel="Signing in..."
          className="mt-6 w-full"
        >
          Sign in
        </LoadingButton>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-bg-subtle" />}>
      <LoginForm />
    </Suspense>
  );
}
