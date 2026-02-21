import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_STATUSES, STATUS_LABELS, type TaskStatus } from "@shared/types";

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
        className="h-7 text-xs font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
