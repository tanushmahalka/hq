import { Link, NavLink, Outlet } from "react-router";
import { ChevronRight, Settings, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/lib/auth-client";
import { useActiveMemberRole } from "@/hooks/use-organization";
import { cn } from "@/lib/utils";

const settingsNavItems = [
  {
    to: "/settings/team",
    label: "Team",
    description: "Invites and members",
    icon: Users,
    requiresOrgAdmin: true,
  },
] as const;

export default function SettingsLayout() {
  const { data: session } = useSession();
  const activeMemberRole = useActiveMemberRole(Boolean(session?.session.activeOrganizationId));
  const isOrgAdmin = activeMemberRole.data?.role === "admin";

  const visibleItems = settingsNavItems.filter((item) =>
    item.requiresOrgAdmin ? isOrgAdmin : true
  );

  return (
    <div className="flex h-full flex-col p-12">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground">
            HQ
          </Link>
          <ChevronRight className="size-4" />
          <span>Settings</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-muted">
            <Settings className="size-5" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Centralized workspace configuration for this HQ deployment.
            </p>
          </div>
        </div>
      </div>

      <div className="grid flex-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <Card className="h-fit py-0">
          <CardHeader className="border-b">
            <CardTitle className="text-base">Workspace settings</CardTitle>
            <CardDescription>
              More sections can live here over time.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-2">
            <nav className="space-y-1">
              {visibleItems.length > 0 ? (
                visibleItems.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={({ isActive }) =>
                        cn(
                          "flex items-start gap-3 rounded-lg px-3 py-3 text-sm transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )
                      }
                    >
                      <Icon className="mt-0.5 size-4" />
                      <div>
                        <div className="font-medium">{item.label}</div>
                        <div className="text-xs opacity-80">{item.description}</div>
                      </div>
                    </NavLink>
                  );
                })
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  No settings sections are available for this account yet.
                </div>
              )}
            </nav>
          </CardContent>
        </Card>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
