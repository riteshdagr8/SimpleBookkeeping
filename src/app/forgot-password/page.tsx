"use client";

import Link from "next/link";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    await fetch("/api/auth/forgot-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setLoading(false); setSent(true);
  }
  return <main className="min-h-screen flex items-center justify-center bg-bg-subtle px-4"><form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm"><h1 className="text-2xl font-semibold text-fg">Forgot password?</h1><p className="mt-1 text-sm text-fg-muted">Enter your email and we&apos;ll send reset instructions.</p>{sent ? <p className="mt-6 rounded-md border border-border px-3 py-2 text-sm text-fg">If an account exists for that email, reset instructions are on their way.</p> : <><label className="mt-6 block text-sm font-medium text-fg" htmlFor="email">Email</label><input id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-fg" /><button disabled={loading} className="mt-6 w-full rounded-md bg-primary px-3 py-2 text-white disabled:opacity-50">{loading ? "Sending..." : "Send reset link"}</button></>}<Link href="/login" className="mt-6 block text-center text-sm text-fg-muted underline">Back to login</Link></form></main>;
}
