import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_STATUSES, STATUS_LABELS, type TaskStatus } from "@shared/types";

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  todo: "bg-gray-400",
  doing: "bg-[var(--swarm-violet)]",
  stuck: "bg-red-400",
  done: "bg-[var(--swarm-mint)]",
};

interface TaskStatusDropdownProps {
  value: TaskStatus;
  onValueChange: (status: TaskStatus) => void;
}

export function TaskStatusDropdown({
  value,
  onValueChange,
}: TaskStatusDropdownProps) {
  return (
    <Select value={value} onValueChange={(v) => onValueChange(v as TaskStatus)}>
      <SelectTrigger
        size="sm"
        className="h-7 text-xs"
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            <span className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${STATUS_DOT_COLORS[status]}`} />
              {STATUS_LABELS[status]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
