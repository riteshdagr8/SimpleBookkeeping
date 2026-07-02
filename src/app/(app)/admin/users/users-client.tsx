"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Eye, EyeOff, KeyRound, Plus, UserX, UserCheck, X } from "lucide-react";
import { LoadingButton } from "@/components/loading-button";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  theme: string;
  createdAt: string;
}

export function UsersClient({
  currentUserId,
  users,
}: {
  currentUserId: string;
  users: AdminUser[];
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [resetFor, setResetFor] = useState<AdminUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <LoadingButton
          onClick={() => {
            setError(null);
            setShowCreate((s) => !s);
          }}
          variant="primary"
        >
          <Plus className="h-4 w-4" /> New user
        </LoadingButton>
      </div>

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      {showCreate && (
        <CreateUserForm
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            setError(null);
            startTransition(() => router.refresh());
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      {resetFor && (
        <ResetPasswordForm
          user={resetFor}
          onClose={() => setResetFor(null)}
          onSaved={() => {
            setResetFor(null);
            setError(null);
            startTransition(() => router.refresh());
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="min-w-full text-sm">
          <thead className="bg-bg-subtle text-left text-xs text-fg-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Created</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const isMe = u.id === currentUserId;
              return (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium text-fg">
                    {u.name}
                    {isMe && <span className="ml-2 text-xs text-fg-muted">(you)</span>}
                  </td>
                  <td className="px-4 py-2 text-fg-muted">{u.email}</td>
                  <td className="px-4 py-2 text-fg">{u.role}</td>
                  <td className="px-4 py-2">
                    {u.active ? (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-fg-muted">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-fg-muted">
                    {format(new Date(u.createdAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setResetFor(u);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-subtle px-2 py-1 text-xs text-fg hover:bg-surface active:scale-[0.97] transition"
                        title="Reset password"
                      >
                        <KeyRound className="h-3 w-3" />
                        Reset
                      </button>
                      {u.active ? (
                        <ToggleActiveButton
                          userId={u.id}
                          isMe={isMe}
                          active={true}
                          onError={setError}
                          onDone={() => startTransition(() => router.refresh())}
                        />
                      ) : (
                        <ToggleActiveButton
                          userId={u.id}
                          isMe={isMe}
                          active={false}
                          onError={setError}
                          onDone={() => startTransition(() => router.refresh())}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ToggleActiveButton({
  userId,
  isMe,
  active,
  onError,
  onDone,
}: {
  userId: string;
  isMe: boolean;
  active: boolean;
  onError: (msg: string | null) => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function go() {
    if (isMe && active) {
      onError("You cannot deactivate your own account.");
      return;
    }
    setBusy(true);
    onError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !active }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Update failed");
      }
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-bg-subtle px-2 py-1 text-xs text-fg hover:bg-surface active:scale-[0.97] transition disabled:opacity-50"
      title={active ? "Deactivate" : "Reactivate"}
    >
      {active ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
      {active ? "Deactivate" : "Reactivate"}
    </button>
  );
}

function CreateUserForm({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string | null) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"Admin" | "Staff">("Staff");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Create failed");
      }
      onCreated();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-border bg-surface p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">New user</h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-fg-muted hover:bg-bg-subtle hover:text-fg"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Name" value={name} onChange={setName} required />
        <Field label="Email" type="email" value={email} onChange={setEmail} required />
        <div>
          <label className="block text-sm font-medium text-fg">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "Admin" | "Staff")}
            className="mt-1 block w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-fg"
          >
            <option value="Staff">Staff</option>
            <option value="Admin">Admin</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-fg">Temporary password</label>
          <div className="relative mt-1">
            <input
              type={show ? "text" : "password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full rounded-md border border-border bg-bg-subtle px-3 py-2 pr-9 text-fg"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute inset-y-0 right-0 flex items-center px-2 text-fg-muted hover:text-fg"
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-fg-muted">
            Share with the user out-of-band. They can change it after signing in (coming soon).
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border bg-bg-subtle px-3 py-1.5 text-sm text-fg hover:bg-surface active:scale-[0.98] transition"
        >
          Cancel
        </button>
        <LoadingButton type="submit" loading={busy} loadingLabel="Creating...">
          Create user
        </LoadingButton>
      </div>
    </form>
  );
}

function ResetPasswordForm({
  user,
  onClose,
  onSaved,
  onError,
}: {
  user: AdminUser;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string | null) => void;
}) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Reset failed");
      }
      onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border border-border bg-surface p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">
          Reset password for {user.name} <span className="font-normal text-fg-muted">({user.email})</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-fg-muted hover:bg-bg-subtle hover:text-fg"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div>
        <label className="block text-sm font-medium text-fg">New temporary password</label>
        <div className="relative mt-1">
          <input
            type={show ? "text" : "password"}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full rounded-md border border-border bg-bg-subtle px-3 py-2 pr-9 text-fg"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 flex items-center px-2 text-fg-muted hover:text-fg"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border bg-bg-subtle px-3 py-1.5 text-sm text-fg hover:bg-surface active:scale-[0.98] transition"
        >
          Cancel
        </button>
        <LoadingButton type="submit" loading={busy} loadingLabel="Saving...">
          Reset password
        </LoadingButton>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-fg">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-fg outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
    </label>
  );
}
