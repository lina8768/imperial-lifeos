import type { TaskStatus, TaskPriority } from "@/storage/db";
import { Badge } from "@/components/ui";

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "待办",
  doing: "进行",
  done: "已成",
  cancelled: "已撤",
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const tone = status === "done" ? "jade" : status === "doing" ? "vermilion" : status === "cancelled" ? "gray" : "neutral";
  return <Badge tone={tone}>{STATUS_LABELS[status]}</Badge>;
}

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "急",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  if (priority === "low") return null;
  const tone = priority === "urgent" ? "danger" : priority === "high" ? "vermilion" : "gold";
  return <Badge tone={tone}>{PRIORITY_LABELS[priority]}</Badge>;
}

export { STATUS_LABELS, PRIORITY_LABELS };
