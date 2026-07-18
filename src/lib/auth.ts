import "next-auth";
import "next-auth/jwt";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: "Admin" | "Staff";
      tenantId: string;
      theme: string;
    };
  }
  interface User {
    id: string;
    email: string;
    name: string;
    role: "Admin" | "Staff";
    tenantId: string;
    theme: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    role: "Admin" | "Staff";
    tenantId: string;
    theme: string;
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        if (!creds?.email || !creds.password) return null;
        const email = String(creds.email).toLowerCase().trim();
        const user = await prisma.user.findUnique({
          where: { email },
        });
        if (!user) {
          console.warn(`[auth] Failed login attempt for unknown email: ${email}`);
          return null;
        }
        if (!user.active) {
          console.warn(`[auth] Failed login attempt for inactive user: ${email}`);
          return null;
        }
        const ok = await compare(String(creds.password), user.password);
        if (!ok) {
          writeAudit({
            tenantId: user.tenantId,
            actorId: user.id,
            action: "LOGIN_FAILED",
            entity: "User",
            entityId: user.id,
            metadata: { email },
          }).catch((e) => console.warn("[auth] Failed to write LOGIN_FAILED audit:", e));
          return null;
        }
        writeAudit({
          tenantId: user.tenantId,
          actorId: user.id,
          action: "LOGIN_OK",
          entity: "User",
          entityId: user.id,
          metadata: { email },
        }).catch((e) => console.warn("[auth] Failed to write LOGIN_OK audit:", e));
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as "Admin" | "Staff",
          tenantId: user.tenantId,
          theme: user.theme,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.theme = user.theme;
      }
      // Allow client-side session.update({ theme }) to refresh the token
      if (trigger === "update" && session?.theme) {
        token.theme = session.theme;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.uid;
        session.user.role = token.role;
        session.user.tenantId = token.tenantId;
        session.user.theme = token.theme;
      }
      return session;
    },
  },
};

export async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }
  // Verify the user still exists in the DB. A session JWT can outlive the
  // underlying user (DB reset, user deletion) and NextAuth will treat it as
  // valid until the cookie expires. This guard catches that and forces a
  // re-login by clearing the session cookies and redirecting.
  const exists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, active: true },
  });
  if (!exists || !exists.active) {
    const cookieStore = await cookies();
    for (const name of [
      "next-auth.session-token",
      "__Secure-next-auth.session-token",
    ]) {
      if (cookieStore.get(name)) cookieStore.delete(name);
    }
    redirect("/login?stale=1");
  }
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "Admin") {
    notFound();
  }
  return user;
}

export async function getOptionalUser() {
  return (await getServerSession(authOptions))?.user ?? null;
}
