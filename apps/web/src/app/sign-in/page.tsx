import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignInPage() {
  const isDev = process.env.NODE_ENV !== "production";
  const githubConfigured = !!process.env.GITHUB_CLIENT_ID && !!process.env.GITHUB_CLIENT_SECRET;

  return (
    <main className="container flex min-h-screen items-center justify-center py-16">
      <div className="w-full max-w-sm space-y-6 rounded-lg border bg-card p-6">
        <header>
          <h1 className="text-xl font-semibold">Sign in to macroscope</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {githubConfigured
              ? "Use GitHub or a dev email to continue."
              : "Dev mode — type any email to continue. Configure GitHub OAuth in .env to enable production sign-in."}
          </p>
        </header>

        {githubConfigured && (
          <form
            action={async () => {
              "use server";
              await signIn("github", { redirectTo: "/dashboard" });
            }}
          >
            <Button type="submit" className="w-full">Continue with GitHub</Button>
          </form>
        )}

        {isDev && (
          <form
            action={async (formData) => {
              "use server";
              const email = String(formData.get("email") ?? "");
              await signIn("credentials", { email, redirectTo: "/dashboard" });
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Dev email</Label>
              <Input id="email" name="email" type="email" placeholder="you@example.com" required />
            </div>
            <Button type="submit" variant="secondary" className="w-full">
              Continue (dev only)
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
