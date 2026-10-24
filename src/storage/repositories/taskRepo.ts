import { db, type Task, type TaskLog, type TaskStatus, type Recurrence } from "@/storage/db";
import { uuid, nowISO, todayKey, addDays, addMonths } from "@/lib/date";

export interface TaskFilters {
  status?: TaskStatus | "all" | "active";
  priority?: string;
  /** today | week | overdue | all */
  dateRange?: "today" | "week" | "overdue" | "all";
}

/** 查询任务（软删除过滤） */
export async function listTasks(filters: TaskFilters = {}): Promise<Task[]> {
  let rows = await db.tasks.toArray();
  rows = rows.filter((t) => !t.deletedAt);
  if (filters.status && filters.status !== "all") {
    if (filters.status === "active") {
      rows = rows.filter((t) => t.status === "todo" || t.status === "doing");
    } else {
      rows = rows.filter((t) => t.status === filters.status);
    }
  }
  if (filters.priority && filters.priority !== "all") {
    rows = rows.filter((t) => t.priority === filters.priority);
  }
  const today = todayKey();
  if (filters.dateRange === "today") {
    rows = rows.filter(
      (t) => t.plannedDate === today || (t.dueDate !== null && t.dueDate < today && t.status !== "done" && t.status !== "cancelled")
    );
  } else if (filters.dateRange === "week") {
    const weekEnd = addDays(today, 7);
    rows = rows.filter((t) => {
      const d = t.plannedDate ?? t.dueDate;
      return d !== null && d >= today && d <= weekEnd;
    });
  } else if (filters.dateRange === "overdue") {
    rows = rows.filter(
      (t) => t.dueDate !== null && t.dueDate < today && t.status !== "done" && t.status !== "cancelled"
    );
  }
  return sortTasks(rows);
}

const STATUS_ORDER: Record<TaskStatus, number> = { doing: 0, todo: 1, done: 2, cancelled: 3 };
const PRIORITY_ORDER = { urgent: 0, high: 1, medium: 2, low: 3 } as const;

export function sortTasks(rows: Task[]): Task[] {
  return [...rows].sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (s !== 0) return s;
    const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (p !== 0) return p;
    const da = a.plannedDate ?? a.dueDate ?? "9999";
    const dbb = b.plannedDate ?? b.dueDate ?? "9999";
    if (da !== dbb) return da < dbb ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: Task["priority"];
  plannedDate?: string | null;
  dueDate?: string | null;
  parentId?: string | null;
  entryId?: string | null;
  recurrence?: Recurrence;
}

export async function createTask(input: TaskInput): Promise<Task> {
  if (!input.title.trim()) throw new Error("任务标题不能为空");
  const now = nowISO();
  const task: Task = {
    id: uuid(),
    title: input.title.trim(),
    description: input.description ?? "",
    status: input.status ?? "todo",
    priority: input.priority ?? "medium",
    plannedDate: input.plannedDate ?? null,
    dueDate: input.dueDate ?? null,
    completedAt: null,
    parentId: input.parentId ?? null,
    entryId: input.entryId ?? null,
    recurrence: input.recurrence ?? "none",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.tasks.add(task);
  if (task.status !== "todo") {
    await addLog(task.id, "status", null, task.status);
  }
  return task;
}

export async function getTask(id: string): Promise<Task | undefined> {
  return db.tasks.get(id);
}

export async function updateTask(id: string, patch: Partial<TaskInput>): Promise<Task> {
  const task = await db.tasks.get(id);
  if (!task) throw new Error(`任务不存在：${id}`);
  const now = nowISO();
  const next: Task = { ...task, ...patch, updatedAt: now };
  if (patch.title !== undefined && !patch.title.trim()) throw new Error("任务标题不能为空");
  if (patch.title !== undefined) next.title = patch.title.trim();
  await db.tasks.put(next);
  if (patch.status && patch.status !== task.status) {
    await addLog(id, "status", task.status, patch.status);
  }
  return next;
}

/** 完成任务；周期任务自动生成下一周期实例 */
export async function completeTask(id: string): Promise<{ task: Task; next?: Task }> {
  const task = await db.tasks.get(id);
  if (!task) throw new Error(`任务不存在：${id}`);
  const now = nowISO();
  const done: Task = { ...task, status: "done", completedAt: now, updatedAt: now };
  await db.tasks.put(done);
  await addLog(id, "status", task.status, "done");

  let next: Task | undefined;
  if (task.recurrence !== "none" && !task.parentId) {
    const base = task.plannedDate ?? todayKey();
    const nextDate =
      task.recurrence === "daily"
        ? addDays(base, 1)
        : task.recurrence === "weekly"
          ? addDays(base, 7)
          : addMonths(base, 1);
    next = await createTask({
      title: task.title,
      description: task.description,
      priority: task.priority,
      plannedDate: nextDate,
      dueDate: task.dueDate ? addDays(task.dueDate, task.recurrence === "daily" ? 1 : task.recurrence === "weekly" ? 7 : 0) : null,
      entryId: task.entryId,
      recurrence: task.recurrence,
    });
  }
  return { task: done, next };
}

export async function cancelTask(id: string): Promise<Task> {
  return updateTask(id, { status: "cancelled" });
}

/** 软删除；子任务一并软删除 */
export async function deleteTask(id: string): Promise<void> {
  const now = nowISO();
  const children = await db.tasks.where("parentId").equals(id).toArray();
  await db.transaction("rw", db.tasks, async () => {
    await db.tasks.update(id, { deletedAt: now, updatedAt: now });
    for (const c of children) {
      if (!c.deletedAt) await db.tasks.update(c.id, { deletedAt: now, updatedAt: now });
    }
  });
}

export async function getSubtasks(parentId: string): Promise<Task[]> {
  const rows = await db.tasks.where("parentId").equals(parentId).toArray();
  return sortTasks(rows.filter((t) => !t.deletedAt));
}

export interface SubtaskProgress {
  total: number;
  done: number;
  ratio: number; // 0~1，无子任务为 0
}

export async function getSubtaskProgress(parentId: string): Promise<SubtaskProgress> {
  const subs = await getSubtasks(parentId);
  const total = subs.length;
  const done = subs.filter((t) => t.status === "done").length;
  return { total, done, ratio: total ? done / total : 0 };
}

export async function addTaskNote(taskId: string, text: string): Promise<TaskLog> {
  if (!text.trim()) throw new Error("记录内容不能为空");
  return addLog(taskId, "note", null, null, text.trim());
}

async function addLog(
  taskId: string,
  type: TaskLog["type"],
  fromStatus: TaskStatus | null,
  toStatus: TaskStatus | null,
  text: string | null = null
): Promise<TaskLog> {
  const log: TaskLog = {
    id: uuid(),
    taskId,
    type,
    fromStatus,
    toStatus,
    text,
    createdAt: nowISO(),
  };
  await db.taskLogs.add(log);
  return log;
}

export async function getTaskLogs(taskId: string): Promise<TaskLog[]> {
  const logs = await db.taskLogs.where("taskId").equals(taskId).toArray();
  return logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 今日概览统计 */
export async function getTodayStats() {
  const today = todayKey();
  const all = (await db.tasks.toArray()).filter((t) => !t.deletedAt);
  const isToday = (t: Task) => t.plannedDate === today;
  const todayTasks = all.filter(isToday);
  const todo = todayTasks.filter((t) => t.status === "todo" || t.status === "doing");
  const done = todayTasks.filter((t) => t.status === "done");
  const overdue = all.filter(
    (t) => t.dueDate !== null && t.dueDate < today && (t.status === "todo" || t.status === "doing")
  );
  return { todayTasks, todo, done, overdue };
}
