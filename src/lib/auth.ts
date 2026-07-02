import "next-auth";
import "next-auth/jwt";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
        const user = await prisma.user.findUnique({
          where: { email: String(creds.email).toLowerCase().trim() },
        });
        if (!user || !user.active) return null;
        const ok = await compare(String(creds.password), user.password);
        if (!ok) return null;
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
  if (!session?.user) {
    redirect("/login");
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
