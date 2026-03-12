import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SeoTabButton({
  active,
  label,
  description,
  onClick,
}: {
  active: boolean;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[1.4rem] border px-4 py-3 text-left transition-all",
        active
          ? "border-primary/20 bg-primary/8 shadow-sm"
          : "border-border/70 bg-background/70 hover:border-primary/15 hover:bg-muted/25",
      )}
    >
      <div className="text-sm font-semibold text-foreground">{label}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

export function SummaryCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rounded-3xl border border-border/70 bg-background/80 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl font-semibold text-foreground">
            {new Intl.NumberFormat().format(value)}
          </div>
        </div>
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">{hint}</div>
    </div>
  );
}

export function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4",
        active
          ? "border-primary/20 bg-primary/10 text-primary hover:bg-primary/12"
          : "border-border bg-background/80 text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Button>
  );
}

export function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/35 p-4">
      <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </div>
      <div className="mt-2 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export function SeoLoadingState() {
  return (
    <>
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-36 rounded-full" />
          <Skeleton className="h-8 w-72 rounded-xl" />
          <Skeleton className="h-4 w-full max-w-3xl rounded-xl" />
        </CardHeader>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-40 rounded-xl" />
          <Skeleton className="h-4 w-56 rounded-xl" />
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24 w-[220px] rounded-3xl" />
            ))}
          </div>
        </CardHeader>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-[560px] w-full rounded-3xl" />
        <Skeleton className="h-[560px] w-full rounded-3xl" />
      </div>
    </>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed border-border/80 bg-card/95">
      <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Icon className="size-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-foreground">{title}</h3>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

export function InlineEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <ShieldCheck className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
