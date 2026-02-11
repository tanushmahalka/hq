import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Comment {
  id: string;
  author: string;
  content: string;
  createdAt: Date;
}

interface TaskCommentsProps {
  taskId: string;
  comments: Comment[];
}

export function TaskComments({ taskId, comments }: TaskCommentsProps) {
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const utils = trpc.useUtils();

  const addComment = trpc.task.comment.add.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.task.get.invalidate({ id: taskId });
      setContent("");
    },
  });

  const deleteComment = trpc.task.comment.delete.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.task.get.invalidate({ id: taskId });
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !content.trim()) return;
    addComment.mutate({ taskId, author: author.trim(), content: content.trim() });
  };

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Comments</h4>

      {comments.length === 0 && (
        <p className="text-xs text-muted-foreground">No comments yet.</p>
      )}

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="rounded-md border p-2 text-sm space-y-1"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium text-xs">{comment.author}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </span>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => deleteComment.mutate({ id: comment.id })}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {comment.content}
            </p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Input
          placeholder="Your name"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="h-7 text-xs"
        />
        <Textarea
          placeholder="Write a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-12 text-xs"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!author.trim() || !content.trim() || addComment.isPending}
        >
          {addComment.isPending ? "Adding..." : "Add Comment"}
        </Button>
      </form>
    </div>
  );
}
