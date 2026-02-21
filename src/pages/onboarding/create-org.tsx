import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { authClient, useSession } from "@/lib/auth-client";

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CreateOrg() {
  const navigate = useNavigate();
  const { refetch } = useSession();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // On mount, check if user already has an org — activate it and skip
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: orgs } = await authClient.organization.list();
      if (cancelled) return;
      if (orgs && orgs.length > 0) {
        await authClient.organization.setActive({
          organizationId: orgs[0].id,
        });
        await refetch();
        navigate("/", { replace: true });
      } else {
        setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [navigate, refetch]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited) {
      setSlug(slugify(value));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data: org, error: createErr } =
      await authClient.organization.create({
        name,
        slug: slug || slugify(name),
      });

    if (createErr) {
      setLoading(false);
      setError(createErr.message ?? "Failed to create organization");
      return;
    }

    if (org) {
      await authClient.organization.setActive({ organizationId: org.id });
      await refetch();
    }

    setLoading(false);
    navigate("/");
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground mb-2">
            <Building2 className="size-5" />
          </div>
          <CardTitle className="text-xl">Create your organization</CardTitle>
          <CardDescription>
            Set up your workspace to get started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization name</Label>
              <Input
                id="org-name"
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme Inc."
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                type="text"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugEdited(true);
                }}
                placeholder="acme-inc"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading || !name}>
              {loading ? "Creating..." : "Create organization"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
