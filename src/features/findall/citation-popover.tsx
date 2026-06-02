import { Quote } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { confidenceDotClass } from "./utils";
import type { BasisEntry } from "./types";

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function CitationPopover({ basis }: { basis: BasisEntry }) {
  const citations = basis.citations ?? [];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="shrink-0 text-muted-foreground/30 hover:text-foreground transition-colors opacity-0 group-hover/cell:opacity-100"
          aria-label="View sources"
        >
          <Quote className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex items-center gap-2 mb-2">
          <span
            className={cn(
              "size-1.5 rounded-full bg-current",
              confidenceDotClass(basis.confidence),
            )}
          />
          <span className="text-xs text-muted-foreground">
            {basis.confidence
              ? `${capitalize(basis.confidence)} confidence`
              : "Sources"}
          </span>
        </div>

        {basis.reasoning && (
          <p className="text-[13px] text-muted-foreground mb-3">
            {basis.reasoning}
          </p>
        )}

        <div className="space-y-2">
          {citations.length === 0 && (
            <p className="text-xs text-muted-foreground/50">No sources cited.</p>
          )}
          {citations.map((citation, index) => (
            <a
              key={index}
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <span className="block text-[13px] text-[var(--swarm-violet)] hover:underline line-clamp-1">
                {citation.title || citation.url || "Source"}
              </span>
              {citation.excerpts?.[0] && (
                <span className="mt-0.5 block text-xs text-muted-foreground/60 line-clamp-2">
                  {citation.excerpts[0]}
                </span>
              )}
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
