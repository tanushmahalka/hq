import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsHome() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>
          Select a section from the sidebar to manage this HQ workspace.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Team management lives under the sidebar now so more settings sections can be added cleanly later.
      </CardContent>
    </Card>
  );
}
