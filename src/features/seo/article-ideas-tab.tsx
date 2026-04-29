import { useDeferredValue, useMemo, useState } from "react";
import { BookOpen, FileText, Search, XCircle } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, InlineEmptyState, SummaryCard } from "./shared";
import type { SeoArticleIdea, SeoArticleIdeasData } from "./types";

function formatIdeaDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently updated";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function normalizeStatus(value: string) {
  return value
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function isCreatedToday(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function getIdeaStatusLabel(idea: SeoArticleIdea) {
  return isCreatedToday(idea.createdAt)
    ? "New - Created Today"
    : normalizeStatus(idea.status);
}

function ArticleIdeaCard({
  idea,
  active,
  onClick,
}: {
  idea: SeoArticleIdea;
  active: boolean;
  onClick: () => void;
}) {
  const createdToday = isCreatedToday(idea.createdAt);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border bg-card p-4 text-left transition-colors",
        active
          ? "border-foreground/20 bg-foreground/[0.03]"
          : createdToday
            ? "border-[var(--swarm-violet)]/35 bg-[var(--swarm-violet-dim)]/35 hover:border-[var(--swarm-violet)]/55 hover:bg-[var(--swarm-violet-dim)]/45"
            : "border-border/40 hover:border-border/70 hover:bg-card",
      )}
    >
      {active || createdToday ? (
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
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{idea.title}</p>
          {idea.description ? (
            <p className="mt-2 line-clamp-2 text-[13px] leading-5 text-muted-foreground">
              {idea.description}
            </p>
          ) : null}
        </div>
        <Badge
          variant={createdToday ? "outline" : "secondary"}
          className={cn(
            "shrink-0 text-[11px] px-2 py-0.5 font-normal",
            createdToday &&
              "border-[var(--swarm-violet)]/35 bg-[var(--swarm-violet-dim)] text-[var(--swarm-violet)]",
          )}
        >
          {getIdeaStatusLabel(idea)}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground/70">
        <span>{formatIdeaDate(idea.updatedAt)}</span>
        {idea.keywordClusterTitle ? <span>- {idea.keywordClusterTitle}</span> : null}
      </div>
    </button>
  );
}

function MarkdownViewer({
  idea,
  onDisqualify,
  isDisqualifying,
}: {
  idea: SeoArticleIdea | null;
  onDisqualify: (idea: SeoArticleIdea) => void;
  isDisqualifying: boolean;
}) {
  if (!idea) {
    return (
      <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-12">
        <p className="text-sm text-muted-foreground/40 text-center">
          Select an article idea to read the draft content here.
        </p>
      </div>
    );
  }

  const markdown = idea.content?.trim() || idea.description?.trim() || "";

  return (
    <article className="rounded-2xl border border-border/40 bg-card/60">
      <div className="border-b border-border/40 px-6 py-6">
        <div className="mb-3 flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
              <FileText className="mr-1 size-3" />
              Article idea
            </Badge>
            <Badge variant="outline" className="text-[11px] px-2 py-0.5 font-normal">
              {getIdeaStatusLabel(idea)}
            </Badge>
            {idea.keywordClusterTitle ? (
              <Badge variant="outline" className="text-[11px] px-2 py-0.5 font-normal">
                {idea.keywordClusterTitle}
              </Badge>
            ) : null}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            disabled={isDisqualifying}
            onClick={() => onDisqualify(idea)}
          >
            <XCircle className="size-3.5" />
            Disqualify
          </Button>
        </div>
        <h2 className="font-display text-4xl font-normal text-foreground">
          {idea.title}
        </h2>
        {idea.description ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {idea.description}
          </p>
        ) : null}
      </div>

      <div className="px-6 py-6">
        {markdown ? (
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:font-normal prose-headings:text-foreground prose-p:leading-7 prose-p:my-3 prose-li:my-1 prose-ul:my-3 prose-ol:my-3 prose-strong:text-foreground prose-a:text-foreground prose-a:underline prose-a:underline-offset-2 prose-pre:overflow-x-auto prose-code:break-words">
            <Markdown remarkPlugins={[remarkGfm]}>{markdown}</Markdown>
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground/40">
            No draft content has been added for this idea yet.
          </p>
        )}
      </div>
    </article>
  );
}

export function ArticleIdeasTab({ siteId }: { siteId: number }) {
  const [search, setSearch] = useState("");
  const [selectedIdeaId, setSelectedIdeaId] = useState<number | null>(null);
  const deferredSearch = useDeferredValue(search);
  const utils = trpc.useUtils();

  const query = trpc.seo.articleIdeas.useQuery(
    { siteId },
    {
      enabled: siteId > 0,
      staleTime: 30_000,
    },
  );

  const disqualifyMutation = trpc.seo.disqualifyArticleIdea.useMutation({
    onMutate: async ({ articleIdeaId }) => {
      await utils.seo.articleIdeas.cancel({ siteId });

      const previousData = utils.seo.articleIdeas.getData({ siteId }) as
        | SeoArticleIdeasData
        | undefined;

      setSelectedIdeaId(null);
      utils.seo.articleIdeas.setData({ siteId }, (current) => {
        const currentData = current as SeoArticleIdeasData | undefined;
        if (!currentData) return current;

        return {
          ...currentData,
          rows: currentData.rows.filter((idea) => idea.id !== articleIdeaId),
        };
      });

      return { previousData };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousData) {
        utils.seo.articleIdeas.setData({ siteId }, context.previousData);
      }
    },
    onSettled: () => {
      setSelectedIdeaId(null);
      utils.seo.articleIdeas.invalidate({ siteId });
    },
  });

  const data = query.data as SeoArticleIdeasData | undefined;

  const filteredIdeas = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();

    return (data?.rows ?? []).filter((idea) => {
      if (!normalizedSearch) return true;
      return [
        idea.title,
        idea.description ?? "",
        idea.status,
        idea.keywordClusterTitle ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [data?.rows, deferredSearch]);

  const selectedIdea =
    filteredIdeas.find((idea) => idea.id === selectedIdeaId) ??
    filteredIdeas[0] ??
    null;
  const summary = useMemo(() => {
    const rows = data?.rows ?? [];
    return {
      total: rows.length,
      withCluster: rows.filter((idea) => idea.keywordClusterId !== null).length,
      withContent: rows.filter((idea) => Boolean(idea.content?.trim())).length,
    };
  }, [data?.rows]);

  if (query.isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-24" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
          <Skeleton className="h-[580px] rounded-2xl" />
          <Skeleton className="h-[580px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (query.isError) {
    return (
      <EmptyState
        icon={BookOpen}
        title="We couldn't load article ideas"
        description={query.error.message}
      />
    );
  }

  if ((data?.rows.length ?? 0) === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="No article ideas yet"
        description="Draft blog ideas stored for this site will show up here."
      />
    );
  }

  return (
    <div className="flex flex-1 min-h-0 flex-col">
      <div className="mb-4 flex items-center gap-8">
        <SummaryCard label="Ideas" value={summary.total} />
        <SummaryCard label="Clustered" value={summary.withCluster} />
        <SummaryCard label="With content" value={summary.withContent} />
      </div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(420px,1.1fr)]">
        <section className="min-h-0 rounded-2xl border border-border/40 bg-card/60">
          <div className="border-b border-border/40 px-6 py-5">
            <div>
              <h2 className="text-sm font-medium text-foreground">Idea list</h2>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Draft blog ideas for the selected site.
              </p>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ideas"
                className="pl-9"
                aria-label="Search article ideas"
              />
            </div>
          </div>

          <div className="max-h-[calc(100vh-20rem)] overflow-y-auto px-4 py-4">
            {filteredIdeas.length === 0 ? (
              <InlineEmptyState
                title="No article ideas match"
                description="Try a different title, status, or cluster search."
              />
            ) : (
              <div className="space-y-2">
                {filteredIdeas.map((idea) => (
                  <ArticleIdeaCard
                    key={idea.id}
                    idea={idea}
                    active={idea.id === selectedIdea?.id}
                    onClick={() => setSelectedIdeaId(idea.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto">
          <MarkdownViewer
            idea={selectedIdea}
            isDisqualifying={disqualifyMutation.isPending}
            onDisqualify={(idea) => {
              disqualifyMutation.mutate({
                siteId,
                articleIdeaId: idea.id,
              });
            }}
          />
        </section>
      </div>
    </div>
  );
}
