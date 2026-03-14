import { ApprovalCard } from "@/components/approvals/approval-card";
import {
  useRef,
  useEffect,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { X, ArrowUp, ChevronDown, Paperclip, Square } from "lucide-react";
import { useApprovals } from "@/hooks/use-approvals";
import {
  useChat,
  type PendingImageAttachment,
  type QueuedChatMessage,
} from "@/hooks/use-chat";
import { useGateway } from "@/hooks/use-gateway";
import { useMessengerPanel } from "@/hooks/use-messenger-panel";
import { ChatSendProvider } from "@/hooks/use-chat-send";
import { UXMessageList } from "@/components/chat/session-blocks";
import { MessageContent } from "./message-content";
import { LoaderFive } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import { parseAgentName } from "@/lib/mentions";
import { useAgentActivity } from "@/hooks/use-agent-activity";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function generateAttachmentId(): string {
  return `attachment-${crypto.randomUUID()}`;
}

async function readFileAsAttachment(
  file: File
): Promise<PendingImageAttachment | null> {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  }).catch(() => "");

  if (!dataUrl) {
    return null;
  }

  return {
    id: generateAttachmentId(),
    dataUrl,
    mimeType: file.type,
    fileName: file.name,
  };
}

function queueSummary(item: QueuedChatMessage): string {
  if (item.text) {
    return item.text.length > 72 ? `${item.text.slice(0, 72)}...` : item.text;
  }
  return `Image${item.attachments.length > 1 ? "s" : ""} (${item.attachments.length})`;
}

/* ── Chat Panel (slides in/out, 420px) ── */

export function ChatPanel() {
  const { agents, connected } = useGateway();
  const { selectedAgentId, selectAgent, closeChat } = useMessengerPanel();

  if (!selectedAgentId) return null;

  return (
    <div className="h-full w-[420px] flex flex-col border-l border-border/50 bg-card relative">
      {/* Active shimmer — top edge */}
      <ActiveShimmer agentId={selectedAgentId} />

      {/* Header — selected agent + agent switcher dropdown + close */}
      <div className="h-11 px-4 flex items-center gap-2 border-b border-border/50 shrink-0">
        {(() => {
          const selectedAgent = agents.find((a) => a.id === selectedAgentId);
          const raw = selectedAgent?.identity?.name ?? selectedAgent?.name ?? selectedAgentId;
          const { name, role } = parseAgentName(raw);
          const otherAgents = agents.filter((a) => a.id !== selectedAgentId);

          return (
            <>
              {/* Selected agent name + role badge */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-sm font-medium truncate">{name}</span>
                {role && (
                  <span className="inline-flex items-center rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground/60 shrink-0">
                    {role}
                  </span>
                )}
                <span
                  className={cn(
                    "size-1.5 rounded-full shrink-0",
                    connected ? "bg-[var(--swarm-mint)]" : "bg-red-400"
                  )}
                />
              </div>

              {/* Other agents dropdown */}
              {otherAgents.length > 0 && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/30 transition-colors">
                      <ChevronDown className="size-3" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[180px]">
                    {otherAgents.map((agent) => {
                      const r = agent.identity?.name ?? agent.name ?? agent.id;
                      const { name: n, role: rl } = parseAgentName(r);
                      return (
                        <DropdownMenuItem
                          key={agent.id}
                          onClick={() => selectAgent(agent.id)}
                          className="flex items-center gap-2"
                        >
                          <span className="text-sm">{n}</span>
                          {rl && (
                            <span className="text-[10px] text-muted-foreground/50">
                              {rl}
                            </span>
                          )}
                        </DropdownMenuItem>
                      );
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </>
          );
        })()}

        <button
          onClick={closeChat}
          className="p-1 rounded text-muted-foreground/40 hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Chat content */}
      <ChatContent agentId={selectedAgentId} />
    </div>
  );
}

/* ── Active shimmer on panel top edge ── */
function ActiveShimmer({ agentId }: { agentId: string }) {
  const { active } = useAgentActivity(agentId);
  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden z-10">
      <div
        className="h-full w-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, var(--swarm-violet) 50%, transparent 100%)",
          opacity: 0.6,
          animation: "swarm-shimmer 2s ease-in-out infinite",
        }}
      />
    </div>
  );
}

/* ── Chat content (messages + input) ── */
function ChatContent({ agentId }: { agentId: string }) {
  const { connected } = useGateway();
  const { agents } = useGateway();
  const { approvals } = useApprovals();
  const {
    rawMessages,
    stream,
    isBusy,
    loading,
    error,
    sendMessage,
    queue,
    canAbort,
    abortRun,
    removeQueuedMessage,
  } = useChat(agentId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionKey = `agent:${agentId}:webchat`;
  const sessionApprovals = approvals.filter(
    (approval) => approval.request.sessionKey === sessionKey,
  );

  const agent = agents.find((a) => a.id === agentId);
  const raw = agent?.identity?.name ?? agent?.name ?? agentId;
  const { name: displayName } = parseAgentName(raw);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [rawMessages, stream]);

  return (
    <>
      {/* Messages */}
      <ChatSendProvider sendMessage={(text) => void sendMessage(text)}>
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto scrollbar-hide"
        >
          {sessionApprovals.length > 0 && (
            <div className="space-y-3 px-4 pt-4">
              {sessionApprovals.map((approval) => (
                <ApprovalCard key={approval.id} approval={approval} />
              ))}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <span className="text-xs text-muted-foreground/40">
                Loading...
              </span>
            </div>
          )}

          {!loading && rawMessages.length === 0 && !isBusy && (
            <p className="text-xs text-muted-foreground/50 text-center py-12">
              Start a conversation
            </p>
          )}

          <UXMessageList messages={rawMessages} />

          {isBusy && (
            <div className="px-4 py-1.5">
              <div className="max-w-[90%] space-y-1.5">
                <LoaderFive text="Thinking..." />
                {stream ? (
                  <div className="text-sm text-foreground/90 leading-relaxed">
                    <MessageContent text={stream} />
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {error && (
            <div className="mx-4 my-2 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
        </div>
      </ChatSendProvider>

      {/* Input — clean, border-top separator */}
      <div className="relative border-t border-border/50 shrink-0">
        <MessengerComposer
          connected={connected}
          isBusy={isBusy}
          canAbort={canAbort}
          queue={queue}
          placeholder={connected ? `Message ${displayName}...` : "Connecting..."}
          onSend={(text, attachments) => sendMessage(text, attachments)}
          onAbort={() => void abortRun()}
          onRemoveQueuedMessage={removeQueuedMessage}
        />
      </div>
    </>
  );
}

export function MessengerComposer({
  connected,
  isBusy,
  canAbort,
  queue,
  placeholder,
  onSend,
  onAbort,
  onRemoveQueuedMessage,
  allowAttachments = true,
  allowQueueWhileBusy = true,
}: {
  connected: boolean;
  isBusy: boolean;
  canAbort: boolean;
  queue: QueuedChatMessage[];
  placeholder: string;
  onSend: (
    text: string,
    attachments: PendingImageAttachment[]
  ) => Promise<"sent" | "queued" | "error" | "ignored">;
  onAbort: () => void;
  onRemoveQueuedMessage: (id: string) => void;
  allowAttachments?: boolean;
  allowQueueWhileBusy?: boolean;
}) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<PendingImageAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = async (files: FileList | File[]) => {
    const nextAttachments = (
      await Promise.all(Array.from(files).map((file) => readFileAsAttachment(file)))
    ).filter((attachment): attachment is PendingImageAttachment => attachment !== null);

    if (nextAttachments.length === 0) {
      return;
    }

    setAttachments((prev) => [...prev, ...nextAttachments]);
  };

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const outcome = await onSend(input, attachments);
    if (outcome === "sent" || outcome === "queued") {
      setInput("");
      setAttachments([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const canQueue = allowQueueWhileBusy && isBusy;
  const hasDraft =
    input.trim().length > 0 || (allowAttachments && attachments.length > 0);
  const sendDisabled =
    !connected || !hasDraft || (!allowQueueWhileBusy && isBusy);

  return (
    <>
      {isBusy && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
          <div
            className="h-full w-full animate-pulse-soft"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, color-mix(in oklab, var(--swarm-violet) 55%, transparent) 18%, color-mix(in oklab, var(--swarm-violet) 92%, white 8%) 50%, color-mix(in oklab, var(--swarm-violet) 55%, transparent) 82%, transparent 100%)",
              boxShadow: "0 0 12px color-mix(in oklab, var(--swarm-violet) 65%, transparent)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, var(--swarm-violet) 50%, transparent 100%)",
              opacity: 0.9,
              animation: "swarm-shimmer 2s ease-in-out infinite",
            }}
          />
        </div>
      )}
      {queue.length > 0 && (
        <div className="border-b border-border/40 px-3 py-2 space-y-1.5">
          <div className="text-[11px] text-muted-foreground/50 uppercase tracking-[0.12em]">
            Queued ({queue.length})
          </div>
          <div className="space-y-1">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/20 px-2.5 py-1.5"
              >
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground/80">
                  {queueSummary(item)}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveQueuedMessage(item.id)}
                  className="rounded p-0.5 text-muted-foreground/40 transition-colors hover:text-foreground"
                  aria-label="Remove queued message"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {allowAttachments && attachments.length > 0 && (
        <div className="border-b border-border/40 px-3 py-2">
          <div className="flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative overflow-hidden rounded-md border border-border/40 bg-muted/20"
              >
                <img
                  src={attachment.dataUrl}
                  alt="Attachment preview"
                  className="size-16 object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    setAttachments((prev) =>
                      prev.filter((item) => item.id !== attachment.id)
                    )
                  }
                  className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-muted-foreground/70 shadow-sm transition-colors hover:text-foreground"
                  aria-label="Remove attachment"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="relative flex items-end">
        {allowAttachments && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              if (e.target.files) {
                void addFiles(e.target.files);
              }
            }}
          />
        )}
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPaste={(e: ClipboardEvent<HTMLTextAreaElement>) => {
            if (!allowAttachments) {
              return;
            }
            const imageFiles = Array.from(e.clipboardData.files).filter((file) =>
              file.type.startsWith("image/")
            );
            if (imageFiles.length === 0) {
              return;
            }
            e.preventDefault();
            void addFiles(imageFiles);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleSubmit();
            }
          }}
          placeholder={placeholder}
          disabled={!connected}
          rows={1}
          className="flex-1 bg-transparent px-4 py-3 pr-12 text-sm resize-none outline-none placeholder:text-muted-foreground/50 disabled:opacity-30 max-h-32 leading-relaxed"
          style={{ minHeight: "44px" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "44px";
            target.style.height = Math.min(target.scrollHeight, 128) + "px";
          }}
        />
        <div className="absolute right-3 bottom-2.5 flex items-center gap-1.5">
          {allowAttachments && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={!connected}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach images"
            >
              <Paperclip className="size-3.5" />
            </Button>
          )}
          {canAbort && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={!connected}
              onClick={onAbort}
              aria-label="Stop run"
            >
              <Square className="size-3" />
            </Button>
          )}
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={sendDisabled}
            aria-label={canQueue ? "Queue message" : "Send message"}
            title={canQueue ? "Queue message" : "Send message"}
          >
            <span>{canQueue ? "Queue" : "Send"}</span>
            <ArrowUp className="size-3.5" />
          </Button>
        </div>
      </form>
    </>
  );
}
