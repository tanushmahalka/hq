import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";

interface EbookCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ebookId: number) => void;
}

export function EbookCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: EbookCreateDialogProps) {
  const utils = trpc.useUtils();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");

  const createEbook = trpc.marketing.asset.create.useMutation({
    onSuccess: (ebook) => {
      utils.marketing.asset.list.invalidate({ assetType: "ebook" });
      resetForm();
      onOpenChange(false);
      onCreated(ebook.id);
    },
    onError: (error) => {
      toast.error("Failed to create ebook", { description: error.message });
    },
  });

  function resetForm() {
    setTitle("");
    setSlug("");
    setDescription("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    createEbook.mutate({
      assetType: "ebook",
      title: title.trim(),
      slug: slug.trim() || undefined,
      description: description.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl font-normal">
            Create Ebook
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm">Title *</label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="The CEO's Guide to..."
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm">Slug</label>
            <Input
              value={slug}
              onChange={(event) => setSlug(event.target.value)}
              placeholder="auto-generated if left blank"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm">Description</label>
            <Textarea
              rows={4}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What this ebook is for and how the agent should treat it."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || createEbook.isPending}
            >
              {createEbook.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              {createEbook.isPending ? "Creating..." : "Create Ebook"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
