import { useState } from "react";
import { Check, MessageSquare } from "lucide-react";
import { useChatSend } from "@/hooks/use-chat-send";

export interface ChoiceOption {
  label: string;
  description?: string;
}

export interface ChoicesPayload {
  type: "choices";
  question: string;
  options: ChoiceOption[];
  allowCustom?: boolean;
}

/**
 * Detect whether a parsed JSON object is a choices payload.
 */
export function isChoicesPayload(obj: unknown): obj is ChoicesPayload {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    o.type === "choices" &&
    typeof o.question === "string" &&
    Array.isArray(o.options) &&
    o.options.length > 0
  );
}

export function ChoiceCard({ payload }: { payload: ChoicesPayload }) {
  const chatSend = useChatSend();
  const [selected, setSelected] = useState<string | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customText, setCustomText] = useState("");

  const handleSelect = (label: string) => {
    setSelected(label);
    setCustomMode(false);
    chatSend?.sendMessage(label);
  };

  const handleCustomSubmit = () => {
    if (!customText.trim()) return;
    setSelected(customText.trim());
    setCustomMode(false);
    chatSend?.sendMessage(customText.trim());
  };

  const isDisabled = selected !== null;

  return (
    <div className="my-2 rounded-lg border border-border/40 bg-card/80 overflow-hidden max-w-[360px]">
      {/* Question header */}
      <div className="px-3.5 py-2.5">
        <p className="text-sm text-foreground/90 leading-relaxed">
          {payload.question}
        </p>
      </div>

      {/* Options */}
      <div className="px-3 pb-2 space-y-1.5">
        {payload.options.map((opt, i) => {
          const isSelected = selected === opt.label;
          return (
            <button
              key={i}
              disabled={isDisabled}
              onClick={() => handleSelect(opt.label)}
              className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${
                isSelected
                  ? "border-[var(--swarm-violet)]/40 bg-[var(--swarm-violet-dim)]"
                  : isDisabled
                    ? "border-border/20 bg-muted/10 opacity-40"
                    : "border-border/40 bg-background/50 hover:border-[var(--swarm-violet)]/30 hover:bg-[var(--swarm-violet-dim)]/50"
              }`}
            >
              <div className="flex items-start gap-2">
                <div
                  className={`mt-0.5 size-4 rounded-full border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? "border-[var(--swarm-violet)] bg-[var(--swarm-violet)]"
                      : "border-border/60"
                  }`}
                >
                  {isSelected && <Check className="size-2.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-foreground">{opt.label}</span>
                  {opt.description && (
                    <p className="text-[11px] text-muted-foreground/50 leading-relaxed mt-0.5">
                      {opt.description}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {/* Custom input option */}
        {(payload.allowCustom !== false) && !isDisabled && (
          <>
            {!customMode ? (
              <button
                onClick={() => setCustomMode(true)}
                className="w-full text-left rounded-md border border-dashed border-border/30 px-3 py-2 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 hover:border-border/50 transition-colors flex items-center gap-2"
              >
                <MessageSquare className="size-3" />
                Type something else...
              </button>
            ) : (
              <div className="rounded-md border border-[var(--swarm-violet)]/30 bg-background/50 p-2">
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleCustomSubmit();
                    }
                    if (e.key === "Escape") {
                      setCustomMode(false);
                      setCustomText("");
                    }
                  }}
                  placeholder="Type your answer..."
                  autoFocus
                  rows={2}
                  className="w-full bg-transparent text-sm outline-none resize-none placeholder:text-muted-foreground/30 leading-relaxed"
                />
                <div className="flex items-center justify-end gap-2 mt-1.5">
                  <button
                    onClick={() => {
                      setCustomMode(false);
                      setCustomText("");
                    }}
                    className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors px-2 py-0.5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCustomSubmit}
                    disabled={!customText.trim()}
                    className="text-[10px] font-medium text-[var(--swarm-violet)] hover:text-[var(--swarm-violet)]/80 transition-colors px-2 py-0.5 rounded bg-[var(--swarm-violet-dim)] disabled:opacity-30"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Selected custom text indicator */}
        {isDisabled && selected && !payload.options.some((o) => o.label === selected) && (
          <div className="rounded-md border border-[var(--swarm-violet)]/40 bg-[var(--swarm-violet-dim)] px-3 py-2 flex items-start gap-2">
            <div className="mt-0.5 size-4 rounded-full border border-[var(--swarm-violet)] bg-[var(--swarm-violet)] flex items-center justify-center shrink-0">
              <Check className="size-2.5 text-white" />
            </div>
            <span className="text-sm text-foreground">{selected}</span>
          </div>
        )}
      </div>
    </div>
  );
}
