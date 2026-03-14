import { cn } from "@/lib/utils";
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
        "flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors border-b-2 -mb-px",
        active
          ? "border-foreground text-foreground font-medium"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      <span className="text-[11px] text-muted-foreground font-normal">
        {description}
      </span>
    </button>
  );
}

export function SummaryCard({
  label,
  value,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-2xl font-normal text-foreground tabular-nums">
        {new Intl.NumberFormat().format(value)}
      </span>
      <span className="text-xs text-muted-foreground/60">{label}</span>
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
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-foreground/20 bg-foreground/5 text-foreground"
          : "border-border/50 text-muted-foreground hover:text-foreground hover:border-border",
      )}
    >
      {label}
    </button>
  );
}

export function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-2 text-muted-foreground w-36 shrink-0">
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex-1 min-w-0 text-sm">{value}</div>
    </div>
  );
}

export function SeoLoadingState() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-[400px] w-full rounded-xl" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-[300px] w-full rounded-xl" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    </div>
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
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Icon className="size-8 mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-sm text-muted-foreground/40 mt-1 max-w-md">{description}</p>
    </div>
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
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-sm text-muted-foreground/40 mt-1 max-w-md">{description}</p>
    </div>
  );
}
