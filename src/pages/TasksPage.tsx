import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Trash2, Undo2, CheckCircle2, XCircle, MessageSquarePlus, Link2 } from "lucide-react";
import { PageHeader, Button, Input, Select, Textarea, EmptyState, Badge, ProgressBar } from "@/components/ui";
import { Dialog, ConfirmDialog } from "@/components/Dialog";
import { TaskStatusBadge, PriorityBadge } from "@/components/taskBadges";
import {
  listTasks, createTask, updateTask, completeTask, cancelTask, deleteTask,
  getSubtasks, getSubtaskProgress, getTaskLogs, addTaskNote, getTask,
  type TaskFilters,
} from "@/storage/repositories/taskRepo";
import { getEntry } from "@/storage/repositories/libraryRepo";
import { type Task, type TaskStatus, type TaskPriority, type Recurrence, type TaskLog } from "@/storage/db";
import { formatShort, isOverdue } from "@/lib/date";

const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "单次",
  daily: "每日",
  weekly: "每周",
  monthly: "每月",
};

export default function TasksPage() {
  const [params] = useSearchParams();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [filters, setFilters] = useState<TaskFilters>({ status: "active", dateRange: "all" });
  const [editing, setEditing] = useState<Task | "new" | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);

  const focusId = params.get("focus");

  async function refresh() {
    setTasks(await listTasks(filters));
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    if (focusId) {
      void getTask(focusId).then((t) => t && setEditing(t));
    }
  }, [focusId]);

  const stats = useMemo(() => {
    if (!tasks) return null;
    return {
      total: tasks.length,
      done: tasks.filter((t) => t.status === "done").length,
    };
  }, [tasks]);

  return (
    <div>
      <PageHeader
        title="奏折与政务"
        subtitle={stats ? `共 ${stats.total} 道 · 已成 ${stats.done} 道` : undefined}
        actions={
          <Button variant="primary" onClick={() => setEditing("new")}>
            <Plus size={14} /> 拟奏折
          </Button>
        }
      />

      {/* 筛选栏 */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Select
          value={filters.status ?? "active"}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as TaskFilters["status"] }))}
          className="w-28"
          aria-label="状态筛选"
        >
          <option value="active">进行中</option>
          <option value="all">全部</option>
          <option value="todo">待办</option>
          <option value="doing">进行</option>
          <option value="done">已成</option>
          <option value="cancelled">已撤</option>
        </Select>
        <Select
          value={filters.priority ?? "all"}
          onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}
          className="w-24"
          aria-label="优先级筛选"
        >
          <option value="all">全部优先级</option>
          <option value="urgent">急</option>
          <option value="high">高</option>
          <option value="medium">中</option>
          <option value="low">低</option>
        </Select>
        <Select
          value={filters.dateRange ?? "all"}
          onChange={(e) => setFilters((f) => ({ ...f, dateRange: e.target.value as TaskFilters["dateRange"] }))}
          className="w-28"
          aria-label="日期筛选"
        >
          <option value="all">全部日期</option>
          <option value="today">今日相关</option>
          <option value="week">未来一周</option>
          <option value="overdue">已逾期</option>
        </Select>
      </div>

      {!tasks ? (
        <p className="p-4 text-sm text-ink-faint">加载中……</p>
      ) : tasks.length === 0 ? (
        <EmptyState
          title="尚无奏折"
          hint="点击「拟奏折」创建第一道任务。"
          action={
            <Button variant="primary" onClick={() => setEditing("new")}>
              <Plus size={14} /> 拟奏折
            </Button>
          }
        />
      ) : (
        <ul className="space-y-2">
          {tasks
            .filter((t) => !t.parentId)
            .map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onOpen={() => setEditing(task)}
                onChanged={refresh}
                onDelete={() => setDeleting(task)}
              />
            ))}
        </ul>
      )}

      {/* 新建/编辑对话框 */}
      {editing && (
        <TaskDialog
          task={editing === "new" ? null : editing}
          onClose={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}

      {/* 删除确认 */}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="撤销此奏折？"
        description={deleting ? `「${deleting.title}」及其子任务将被移入删除，可在备份中恢复。` : undefined}
        confirmLabel="确认撤销"
        danger
        onConfirm={async () => {
          if (deleting) await deleteTask(deleting.id);
          setDeleting(null);
          await refresh();
        }}
      >
        <p className="rounded bg-danger/5 p-3 text-xs leading-relaxed text-danger">
          ⚠️ 此操作会将该任务（含子任务）软删除。当前版本不提供界面内恢复入口，删除前请先导出备份。
        </p>
      </ConfirmDialog>
    </div>
  );
}

/* ============ 任务行 ============ */

function TaskRow({ task, onOpen, onChanged, onDelete }: { task: Task; onOpen: () => void; onChanged: () => void; onDelete: () => void }) {
  const [subs, setSubs] = useState<{ total: number; done: number } | null>(null);

  useEffect(() => {
    void getSubtaskProgress(task.id).then((p) => setSubs(p));
  }, [task.id, task.updatedAt]);

  async function toggleComplete() {
    if (task.status === "done") {
      await updateTask(task.id, { status: "todo" });
    } else {
      await completeTask(task.id);
    }
    onChanged();
  }

  return (
    <li className="panel group px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          aria-label={task.status === "done" ? "标记为待办" : "标记完成"}
          onClick={() => void toggleComplete()}
          className={`shrink-0 rounded-full border transition-colors ${
            task.status === "done"
              ? "border-jade bg-jade text-white"
              : "border-line text-transparent hover:border-jade hover:text-jade-soft"
          } h-5 w-5`}
        >
          <CheckCircle2 size={20} className="-m-px" />
        </button>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className={`text-sm ${task.status === "done" ? "text-ink-faint line-through" : task.status === "cancelled" ? "text-ink-faint line-through decoration-ink-faint/50" : ""}`}>
            {task.title}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <TaskStatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            {task.recurrence !== "none" && <Badge tone="gold">{RECURRENCE_LABELS[task.recurrence]}</Badge>}
            {task.entryId && (
              <Badge tone="neutral">
                <Link2 size={10} /> 典籍
              </Badge>
            )}
            {task.plannedDate && <span className="text-[11px] text-ink-faint">计划 {formatShort(task.plannedDate)}</span>}
            {task.dueDate && (
              <span className={`text-[11px] ${isOverdue(task.dueDate, task.status) ? "font-medium text-danger" : "text-ink-faint"}`}>
                截止 {formatShort(task.dueDate)}
              </span>
            )}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {task.status !== "cancelled" && task.status !== "done" && (
            <button aria-label="取消任务" title="撤回" onClick={() => void cancelTask(task.id).then(onChanged)} className="rounded p-1.5 text-ink-faint hover:bg-paper hover:text-ink">
              <XCircle size={15} />
            </button>
          )}
          {(task.status === "cancelled" || task.status === "done") && (
            <button aria-label="恢复为待办" title="恢复" onClick={() => void updateTask(task.id, { status: "todo" }).then(onChanged)} className="rounded p-1.5 text-ink-faint hover:bg-paper hover:text-ink">
              <Undo2 size={15} />
            </button>
          )}
          <button aria-label="删除任务" title="删除" onClick={onDelete} className="rounded p-1.5 text-ink-faint hover:bg-danger/10 hover:text-danger">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
      {subs && subs.total > 0 && (
        <div className="mt-2 flex items-center gap-2 pl-8">
          <ProgressBar ratio={subs.done / subs.total} className="max-w-48" />
          <span className="text-[11px] text-ink-faint">
            {subs.done}/{subs.total}
          </span>
        </div>
      )}
    </li>
  );
}

/* ============ 任务编辑对话框 ============ */

function TaskDialog({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const isNew = task === null;
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? "todo");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [plannedDate, setPlannedDate] = useState(task?.plannedDate ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [recurrence, setRecurrence] = useState<Recurrence>(task?.recurrence ?? "none");
  const [error, setError] = useState("");

  const [subs, setSubs] = useState<Task[]>([]);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [subTitle, setSubTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [entryTitle, setEntryTitle] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    void getSubtasks(task.id).then(setSubs);
    void getTaskLogs(task.id).then(setLogs);
    if (task.entryId) {
      void getEntry(task.entryId).then((e) => setEntryTitle(e?.title ?? null));
    }
  }, [task]);

  async function save() {
    try {
      setError("");
      if (!title.trim()) {
        setError("标题不能为空");
        return;
      }
      const payload = {
        title,
        description,
        status,
        priority,
        plannedDate: plannedDate || null,
        dueDate: dueDate || null,
        recurrence,
      };
      if (isNew) {
        await createTask(payload);
      } else {
        await updateTask(task.id, payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function addSub() {
    if (!task || !subTitle.trim()) return;
    await createTask({ title: subTitle, parentId: task.id, plannedDate: task.plannedDate });
    setSubTitle("");
    setSubs(await getSubtasks(task.id));
  }

  async function addNote() {
    if (!task || !noteText.trim()) return;
    await addTaskNote(task.id, noteText);
    setNoteText("");
    setLogs(await getTaskLogs(task.id));
  }

  async function toggleSub(sub: Task) {
    if (!task) return;
    if (sub.status === "done") await updateTask(sub.id, { status: "todo" });
    else await completeTask(sub.id);
    setSubs(await getSubtasks(task.id));
  }

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? "拟奏折" : "批阅奏折"}
      description={task ? `创建于 ${formatShort(task.createdAt.slice(0, 10))}` : undefined}
      wide
    >
      <div className="space-y-4">
        <div>
          <label className="label" htmlFor="task-title">标题</label>
          <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="一句话说清要做的事" />
        </div>
        <div>
          <label className="label" htmlFor="task-desc">详情备注</label>
          <Textarea id="task-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="背景、步骤、标准……" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <label className="label" htmlFor="task-status">状态</label>
            <Select id="task-status" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
              <option value="todo">待办</option>
              <option value="doing">进行</option>
              <option value="done">已成</option>
              <option value="cancelled">已撤</option>
            </Select>
          </div>
          <div>
            <label className="label" htmlFor="task-priority">优先级</label>
            <Select id="task-priority" value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="urgent">急</option>
            </Select>
          </div>
          <div>
            <label className="label" htmlFor="task-planned">计划日期</label>
            <Input id="task-planned" type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="task-due">截止日期</label>
            <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="task-rec">周期</label>
            <Select id="task-rec" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)} disabled={!!task?.parentId}>
              <option value="none">单次</option>
              <option value="daily">每日</option>
              <option value="weekly">每周</option>
              <option value="monthly">每月</option>
            </Select>
          </div>
          {entryTitle && (
            <div>
              <span className="label">关联典籍</span>
              <p className="truncate rounded border border-gold/30 bg-gold-soft px-3 py-2 text-xs text-gold">{entryTitle}</p>
            </div>
          )}
        </div>

        {!isNew && (
          <>
            {/* 子任务 */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="label mb-0">子任务</span>
                {subs.length > 0 && (
                  <span className="text-[11px] text-ink-faint">
                    {subs.filter((s) => s.status === "done").length}/{subs.length}
                  </span>
                )}
              </div>
              {subs.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {subs.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 rounded border border-line bg-paper px-2.5 py-1.5">
                      <button
                        aria-label="切换子任务状态"
                        onClick={() => void toggleSub(s)}
                        className={`h-4 w-4 shrink-0 rounded-full border ${s.status === "done" ? "border-jade bg-jade" : "border-line hover:border-jade"}`}
                      />
                      <span className={`min-w-0 flex-1 truncate text-xs ${s.status === "done" ? "text-ink-faint line-through" : ""}`}>
                        {s.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void addSub()}
                  placeholder="添加子任务…"
                  className="py-1.5 text-xs"
                />
                <Button size="sm" onClick={() => void addSub()} disabled={!subTitle.trim()}>
                  <Plus size={12} /> 添加
                </Button>
              </div>
            </div>

            {/* 过程记录 */}
            <div>
              <span className="label">过程记录</span>
              {logs.length > 0 && (
                <ul className="mb-2 max-h-36 space-y-1 overflow-y-auto">
                  {logs.map((log) => (
                    <li key={log.id} className="rounded bg-paper px-2.5 py-1.5 text-xs text-ink-soft">
                      <span className="text-ink-faint">{log.createdAt.slice(5, 16).replace("T", " ")}</span>{" "}
                      {log.type === "status" ? (
                        <>状态：{log.fromStatus ?? "—"} → {log.toStatus ?? "—"}</>
                      ) : (
                        log.text
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void addNote()}
                  placeholder="记录进展…"
                  className="py-1.5 text-xs"
                />
                <Button size="sm" onClick={() => void addNote()} disabled={!noteText.trim()}>
                  <MessageSquarePlus size={12} /> 记录
                </Button>
              </div>
            </div>
          </>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={() => void save()}>
            {isNew ? "落笔" : "批红"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export { RECURRENCE_LABELS };
