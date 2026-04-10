export default function Files() {
  return (
    <div className="flex h-full flex-col p-12">
      <div className="pt-4 pb-8">
        <h1 className="font-display text-5xl font-normal text-foreground">
          Files
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The files workspace is being rebuilt for the API-based app architecture.
        </p>
      </div>

      <div className="rounded-2xl border border-border/40 bg-card/80 px-6 py-8">
        <p className="text-sm text-muted-foreground/70">
          File browsing is temporarily unavailable in this migration branch.
        </p>
      </div>
    </div>
  );
}
