"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null); const [error, setError] = useState(false);
  async function submit(e: React.FormEvent) { e.preventDefault(); setMessage(null); setError(false); if (password !== confirm) { setError(true); setMessage("Passwords do not match."); return; } const res = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) }); const data = await res.json(); setError(!res.ok); setMessage(res.ok ? "Your password has been reset. You can now sign in." : data.error); }
  return <main className="min-h-screen flex items-center justify-center bg-bg-subtle px-4"><form onSubmit={submit} className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-sm"><h1 className="text-2xl font-semibold text-fg">Reset your password</h1><label className="mt-6 block text-sm font-medium text-fg" htmlFor="password">New password</label><input id="password" type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-fg" /><label className="mt-4 block text-sm font-medium text-fg" htmlFor="confirm">Confirm password</label><input id="confirm" type="password" minLength={8} required value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1 block w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-fg" />{message && <p className={`mt-4 text-sm ${error ? "text-danger" : "text-fg"}`}>{message}</p>}<button className="mt-6 w-full rounded-md bg-primary px-3 py-2 text-white">Reset password</button><Link href="/login" className="mt-6 block text-center text-sm text-fg-muted underline">Back to login</Link></form></main>;
}
export default function ResetPasswordPage() { return <Suspense fallback={<main className="min-h-screen bg-bg-subtle" />}><ResetForm /></Suspense>; }
