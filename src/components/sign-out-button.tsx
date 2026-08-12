"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await signOut({ redirect: false });
        window.location.assign("/login");
      }}
      className="rounded-md border border-border bg-bg-subtle px-3 py-1.5 text-fg shadow-sm hover:bg-surface active:scale-[0.98] transition"
    >
      Sign out
    </button>
  );
}
