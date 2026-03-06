import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, ensureActiveOrganization, useSession } from "@/lib/auth-client";
import { SwarmVisualization } from "@/components/auth/swarm-visualization";

export default function Login() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refetch } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error: err } = await authClient.signIn.email({
      email,
      password,
    });

    if (err) {
      setLoading(false);
      setError(err.message ?? "Invalid credentials");
      return;
    }

    const redirectTo = searchParams.get("redirectTo");
    await refetch();

    const { activeOrganizationId } = await ensureActiveOrganization();
    await refetch();

    if (activeOrganizationId) {
      setLoading(false);
      navigate(redirectTo || "/app");
    } else {
      setLoading(false);
      navigate(redirectTo || "/app/no-access");
    }
  }

  return (
    <div className="flex h-screen">
      {/* Left — form */}
      <div className="w-full lg:w-[480px] xl:w-[520px] shrink-0 flex flex-col justify-center px-8 sm:px-16 bg-background">
        <div className="w-full max-w-sm mx-auto">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-10">
            <div className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.65_0.18_280)] to-[oklch(0.68_0.15_245)] text-white shadow-sm">
              <Bot className="size-5" />
            </div>
            <span className="font-medium text-lg tracking-wide">HQ</span>
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-normal mb-1">Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-8">
            Sign in to your command center
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
                autoFocus
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-10"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full h-10" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            Need access? Ask your HQ admin for an invite link.
          </p>
        </div>
      </div>

      {/* Right — swarm visualization */}
      <div className="hidden lg:block flex-1 border-l border-border/30">
        <SwarmVisualization />
      </div>
    </div>
  );
}
