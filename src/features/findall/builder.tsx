import { useState } from "react";
import { ArrowLeft, Sparkles, Plus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FindallResults } from "./results";
import { makeId, formatDepthPrice, estimateDepthCost } from "./utils";
import {
  DEPTH_OPTIONS,
  RESULT_COUNT_PRESETS,
  type EditableCondition,
  type EditableEnrichment,
  type FindallGenerator,
} from "./types";

const EXAMPLES = [
  "AI startups in Europe that raised a seed round in 2024",
  "B2B SaaS companies in fintech with more than 50 employees",
  "Design agencies in New York that work with consumer brands",
];

interface ListBuilderProps {
  onBack: () => void;
  onOpenList: (listId: number) => void;
}

type Phase = "describe" | "review" | "live";

export function ListBuilder({ onBack, onOpenList }: ListBuilderProps) {
  const [phase, setPhase] = useState<Phase>("describe");
  const [objective, setObjective] = useState("");
  const [title, setTitle] = useState("");
  const [entityType, setEntityType] = useState("");
  const [conditions, setConditions] = useState<EditableCondition[]>([]);
  const [enrichments, setEnrichments] = useState<EditableEnrichment[]>([]);
  const [generator, setGenerator] = useState<FindallGenerator>("core");
  const [matchLimit, setMatchLimit] = useState(25);
  const [createdRun, setCreatedRun] = useState<{ id: number; listId: number } | null>(null);

  const ingest = trpc.custom.findall.ingest.useMutation();
  const suggest = trpc.custom.findall.suggestEnrichments.useMutation();
  const create = trpc.custom.findall.create.useMutation();

  const selectedDepth =
    DEPTH_OPTIONS.find((option) => option.generator === generator) ??
    DEPTH_OPTIONS[2];

  const handleContinue = async () => {
    const trimmed = objective.trim();
    if (!trimmed) return;
    try {
      const ingested = await ingest.mutateAsync({ objective: trimmed });
      setEntityType(ingested.entityType ?? "");
      setConditions(
        ingested.matchConditions.map((c) => ({
          id: makeId("cond"),
          name: c.name,
          description: c.description,
        })),
      );
      setTitle((current) => current || trimmed);

      const suggested = await suggest.mutateAsync({
        objective: trimmed,
        entityType: ingested.entityType,
        matchConditions: ingested.matchConditions,
      });
      setEnrichments(
        suggested.enrichments.map((e) => ({
          id: makeId("enr"),
          name: e.name,
          description: e.description,
          type: e.type,
          format: e.format,
        })),
      );
      setPhase("review");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not interpret that.",
      );
    }
  };

  const handleBuild = async () => {
    const cleanConditions = conditions
      .map((c) => ({ name: c.name.trim(), description: c.description.trim() }))
      .filter((c) => c.name && c.description);
    if (cleanConditions.length === 0) {
      toast.error("Add at least one condition that describes a good match.");
      return;
    }
    const cleanEnrichments = enrichments
      .map((e) => ({
        name: e.name.trim(),
        description: e.description.trim(),
        type: e.type,
        format: e.format,
      }))
      .filter((e) => e.name && e.description);

    try {
      const result = await create.mutateAsync({
        title: title.trim() || objective.trim(),
        objective: objective.trim(),
        entityType: entityType.trim() || undefined,
        matchConditions: cleanConditions,
        enrichments: cleanEnrichments,
        generator,
        matchLimit,
      });
      setCreatedRun({ id: result.run.id, listId: result.listId });
      setPhase("live");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the build.");
    }
  };

  if (phase === "live" && createdRun) {
    return (
      <FindallResults
        runId={createdRun.id}
        listId={createdRun.listId}
        title={title.trim() || objective.trim()}
        onBack={onBack}
        onOpenList={onOpenList}
      />
    );
  }

  if (phase === "review") {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-12">
        <button
          onClick={() => setPhase("describe")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit pb-6"
        >
          <ArrowLeft className="size-4" />
          Back
        </button>

        <div className="max-w-2xl w-full mx-auto space-y-8">
          <div>
            <h1 className="font-display text-4xl font-normal text-foreground">
              Review your list
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We&rsquo;ll find{" "}
              <input
                value={entityType}
                onChange={(event) => setEntityType(event.target.value)}
                placeholder="results"
                className="bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50 w-40"
              />
            </p>
          </div>

          <Field label="List name">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Name this list"
              className="w-full text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
            />
          </Field>

          <EditableSection
            heading="Conditions"
            hint="What makes a good match? Every result must meet these."
            rows={conditions}
            onChange={setConditions}
            namePlaceholder="Short label"
            descriptionPlaceholder="The rule a result must satisfy"
            addLabel="Add condition"
            makeRow={() => ({ id: makeId("cond"), name: "", description: "" })}
          />

          <EditableSection
            heading="Columns to add"
            hint="Extra details to look up for each result."
            rows={enrichments}
            onChange={setEnrichments}
            namePlaceholder="Column name"
            descriptionPlaceholder="What to look up"
            addLabel="Add column"
            makeRow={() => ({ id: makeId("enr"), name: "", description: "" })}
          />

          <Field label="How many">
            <div className="flex items-center gap-2">
              {RESULT_COUNT_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => setMatchLimit(preset)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    matchLimit === preset
                      ? "bg-[var(--swarm-violet-dim)] text-[var(--swarm-violet)]"
                      : "text-muted-foreground hover:bg-muted/40",
                  )}
                >
                  {preset}
                </button>
              ))}
              <input
                type="number"
                min={5}
                max={1000}
                value={matchLimit}
                onChange={(event) =>
                  setMatchLimit(
                    Math.max(5, Math.min(1000, Number(event.target.value) || 5)),
                  )
                }
                className="w-20 rounded-md bg-transparent px-2 py-1.5 text-sm text-muted-foreground outline-none border border-border/40"
              />
            </div>
          </Field>

          <Field label="Depth">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DEPTH_OPTIONS.map((option) => (
                <button
                  key={option.generator}
                  onClick={() => setGenerator(option.generator)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    generator === option.generator
                      ? "border-[var(--swarm-violet)]/40 bg-[var(--swarm-violet-dim)]"
                      : "border-border/40 hover:bg-muted/20",
                  )}
                >
                  <span className="block text-sm">{option.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground/60">
                    {option.hint}
                  </span>
                  <span className="mt-1.5 block text-[11px] text-muted-foreground/50">
                    {formatDepthPrice(option)}
                  </span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/60">
              Up to{" "}
              <span className="text-foreground/80">
                {estimateDepthCost(selectedDepth, matchLimit)}
              </span>{" "}
              for {matchLimit} results — you&rsquo;re only charged for matches
              found.
            </p>
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button onClick={handleBuild} disabled={create.isPending}>
              {create.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Build list
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Describe phase
  const isInterpreting = ingest.isPending || suggest.isPending;
  return (
    <div className="flex flex-col h-full overflow-y-auto p-12">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit pb-6"
      >
        <ArrowLeft className="size-4" />
        Lists
      </button>

      <div className="max-w-2xl w-full mx-auto mt-8">
        <h1 className="font-display text-5xl font-normal text-foreground">
          Build a list with AI
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Describe the list you want and we&rsquo;ll find every match, with
          sources.
        </p>

        <Textarea
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          placeholder="e.g. AI startups in Europe that raised a Series A in 2024"
          className="mt-6 min-h-28 text-base placeholder:text-muted-foreground/50"
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              void handleContinue();
            }
          }}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              onClick={() => setObjective(example)}
              className="rounded-full border border-border/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/30 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleContinue}
            disabled={!objective.trim() || isInterpreting}
          >
            {isInterpreting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

interface EditableRow {
  id: string;
  name: string;
  description: string;
}

function EditableSection<T extends EditableRow>({
  heading,
  hint,
  rows,
  onChange,
  namePlaceholder,
  descriptionPlaceholder,
  addLabel,
  makeRow,
}: {
  heading: string;
  hint: string;
  rows: T[];
  onChange: (rows: T[]) => void;
  namePlaceholder: string;
  descriptionPlaceholder: string;
  addLabel: string;
  makeRow: () => T;
}) {
  const update = (id: string, patch: Partial<EditableRow>) =>
    onChange(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const remove = (id: string) => onChange(rows.filter((row) => row.id !== id));

  return (
    <div className="space-y-2">
      <div>
        <span className="text-sm font-medium text-muted-foreground">
          {heading}
        </span>
        <p className="text-xs text-muted-foreground/60">{hint}</p>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.id}
            className="group flex items-start gap-2 rounded-lg border border-border/40 p-3"
          >
            <div className="flex-1 min-w-0 space-y-1">
              <input
                value={row.name}
                onChange={(event) => update(row.id, { name: event.target.value })}
                placeholder={namePlaceholder}
                className="w-full text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
              />
              <input
                value={row.description}
                onChange={(event) =>
                  update(row.id, { description: event.target.value })
                }
                placeholder={descriptionPlaceholder}
                className="w-full text-xs text-muted-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
              />
            </div>
            <button
              onClick={() => remove(row.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-destructive"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={() => onChange([...rows, makeRow()])}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="size-3.5" />
        {addLabel}
      </button>
    </div>
  );
}
