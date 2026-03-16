import { useMemo, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useLocation } from "react-router";
import { Button } from "@/components/ui/button";

export default function GoogleOauthCallback() {
  const location = useLocation();
  const [copied, setCopied] = useState(false);

  const fullUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return `${location.pathname}${location.search}${location.hash}`;
    }

    return window.location.href;
  }, [location.hash, location.pathname, location.search]);

  const code = new URLSearchParams(location.search).get("code");
  const error = new URLSearchParams(location.search).get("error");

  async function handleCopy() {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,oklch(0.97_0.02_285/.7),transparent_42%),radial-gradient(circle_at_bottom_left,oklch(0.96_0.015_75/.9),transparent_34%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-4xl items-center px-6 py-12 sm:px-10 lg:px-12">
        <div className="w-full overflow-hidden rounded-2xl border border-border/40 bg-card/90 p-6 shadow-[0_24px_80px_oklch(0.2_0.02_280/.08)] backdrop-blur sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
            <div
              className="h-full w-full"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, var(--swarm-violet) 50%, transparent 100%)",
                opacity: 0.5,
                animation: "swarm-shimmer 2s ease-in-out infinite",
              }}
            />
          </div>

          <div className="mb-8 max-w-2xl">
            <p className="mb-3 text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground/70">
              Google OAuth Callback
            </p>
            <h1 className="font-display text-4xl font-normal text-foreground sm:text-5xl">
              Copy this URL back into your CLI
            </h1>
            <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-[15px]">
              Google has finished redirecting to your public callback endpoint. Copy the
              full URL below and paste it into the CLI so it can finish the token exchange.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="rounded-xl border border-border/50 bg-background/80 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">Redirected URL</span>
                <span className="text-xs text-muted-foreground">
                  {error ? "Authorization error" : code ? "Authorization code present" : "Waiting"}
                </span>
              </div>
              <p className="max-h-48 overflow-auto break-all rounded-lg bg-card px-3 py-3 font-mono text-xs text-foreground">
                {fullUrl}
              </p>
            </div>

            <div className="rounded-xl border border-border/50 bg-[var(--swarm-violet-dim)] p-4">
              <p className="text-sm font-medium text-foreground">Next step</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Keep this tab open just long enough to copy the URL, then return to the
                terminal session running on your server.
              </p>
              <Button onClick={handleCopy} className="mt-4 w-full">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied URL" : "Copy full URL"}
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 border-t border-border/50 pt-6 text-sm text-muted-foreground">
            <div className="flex items-start gap-3 rounded-xl bg-background/70 p-4">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-[var(--swarm-violet)]" />
              <p>
                Configure Google OAuth with this exact redirect URI on your public domain,
                for example <span className="font-mono text-xs text-foreground">https://auth.yourdomain.com/oauth/google/callback</span>.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-background/70 p-4">
              <span className="mt-1 size-2 shrink-0 rounded-full bg-[var(--swarm-mint)]" />
              <p>
                The CLI should use the same redirect URI in both the authorization request
                and the token exchange.
              </p>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-background/70 p-4">
              <ExternalLink className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p>
                If you see an OAuth error in the URL instead of a code, copy that URL too so
                the CLI can surface the failure reason.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
