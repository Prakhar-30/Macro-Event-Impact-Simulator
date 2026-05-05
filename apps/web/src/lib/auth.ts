import NextAuth, { type NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { getDb, schema } from "@macroscope/db";
import { eq } from "drizzle-orm";

const isDev = process.env.NODE_ENV !== "production";
const githubConfigured = !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET;

const providers: NextAuthConfig["providers"] = [];

if (githubConfigured) {
  providers.push(
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    })
  );
}

if (isDev) {
  // Dev-only credentials provider — type an email, get a user.
  // Lets local dev work without a GitHub OAuth app.
  providers.push(
    Credentials({
      name: "Dev",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
      },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;

        const db = getDb();
        const existing = await db.query.users.findFirst({
          where: eq(schema.users.email, email),
        });
        if (existing) return { id: existing.id, email: existing.email, name: existing.name ?? null };

        const [created] = await db
          .insert(schema.users)
          .values({ email, name: email.split("@")[0] })
          .returning();
        return { id: created!.id, email: created!.email, name: created!.name ?? null };
      },
    })
  );
}

// NextAuth v5 supports passing a factory so we don't have to evaluate the
// adapter (which calls getDb()) at module-load time. This keeps `next build`
// from requiring DATABASE_URL.
function buildAuthConfig(): NextAuthConfig {
  return {
    adapter: DrizzleAdapter(getDb(), {
      usersTable: schema.users,
      accountsTable: schema.accounts,
      sessionsTable: schema.sessions,
      verificationTokensTable: schema.verificationTokens,
    }),
    session: { strategy: "jwt" },
    providers,
    pages: { signIn: "/sign-in" },
    callbacks: {
      async jwt({ token, user }) {
        if (user) token.userId = user.id;
        return token;
      },
      async session({ session, token }) {
        if (token.userId && session.user) {
          (session.user as { id?: string }).id = token.userId as string;
        }
        return session;
      },
    },
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth(buildAuthConfig);
