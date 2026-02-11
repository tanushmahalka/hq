import { Badge } from "@/components/ui/badge";

interface TaskPriorityBadgeProps {
  urgent: boolean;
  important: boolean;
}

export function TaskPriorityBadge({ urgent, important }: TaskPriorityBadgeProps) {
  if (!urgent && !important) return null;

  return (
    <div className="flex gap-1">
      {urgent && (
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
          Urgent
        </Badge>
      )}
      {important && (
        <Badge variant="default" className="text-[10px] px-1.5 py-0">
          Important
        </Badge>
      )}
    </div>
  );
}
