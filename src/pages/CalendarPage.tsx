import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader, Badge, EmptyState } from "@/components/ui";
import { TaskStatusBadge, PriorityBadge } from "@/components/taskBadges";
import { listTasks } from "@/storage/repositories/taskRepo";
import type { Task } from "@/storage/db";
import { todayKey, toDateKey, formatShort, weekdayCN, isOverdue } from "@/lib/date";
import { cn } from "@/lib/utils";

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export default function CalendarPage() {
  const today = todayKey();
  const [monthAnchor, setMonthAnchor] = useState(today.slice(0, 7)); // YYYY-MM
  const [selected, setSelected] = useState(today);
  const [tasks, setTasks] = useState<Task[] | null>(null);

  useEffect(() => {
    void listTasks({ status: "all" }).then(setTasks);
  }, []);

  const grid = useMemo(() => {
    const [y, m] = monthAnchor.split("-").map(Number);
    const first = new Date(y, m - 1, 1);
    const startOffset = (first.getDay() + 6) % 7; // 周一为 0
    const start = new Date(y, m - 1, 1 - startOffset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      return { key: toDateKey(d), day: d.getDate(), inMonth: d.getMonth() === m - 1 };
    });
  }, [monthAnchor]);

  /** 每个日期的任务（计划或截止落在该日） */
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    if (!tasks) return map;
    for (const t of tasks) {
      if (t.status === "cancelled") continue;
      for (const d of [t.plannedDate, t.dueDate]) {
        if (d) {
          const arr = map.get(d) ?? [];
          arr.push(t);
          map.set(d, arr);
        }
      }
    }
    return map;
  }, [tasks]);

  const dayTasks = (tasksByDate.get(selected) ?? []).sort((a, b) => a.title.localeCompare(b.title));
  const planned = dayTasks.filter((t) => t.plannedDate === selected);
  const dueOnly = dayTasks.filter((t) => t.plannedDate !== selected && t.dueDate === selected);

  function shiftMonth(delta: number) {
    const [y, m] = monthAnchor.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonthAnchor(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  return (
    <div>
      <PageHeader title="日历" subtitle="计划为纲，截止为限，完成留痕" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* 月视图 */}
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <button aria-label="上个月" onClick={() => shiftMonth(-1)} className="rounded p-1.5 text-ink-soft hover:bg-paper">
              <ChevronLeft size={16} />
            </button>
            <h2 className="font-serif text-base font-semibold">
              {monthAnchor.replace("-", " 年 ")} 月
            </h2>
            <button aria-label="下个月" onClick={() => shiftMonth(1)} className="rounded p-1.5 text-ink-soft hover:bg-paper">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 text-center text-[11px] text-ink-faint">
            {WEEK_LABELS.map((w) => (
              <div key={w} className="py-1">周{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map(({ key, day, inMonth }) => {
              const dayList = tasksByDate.get(key) ?? [];
              const hasTodo = dayList.some((t) => t.status !== "done");
              const allDone = dayList.length > 0 && dayList.every((t) => t.status === "done");
              const isToday = key === today;
              const isSel = key === selected;
              return (
                <button
                  key={key}
                  onClick={() => setSelected(key)}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-1 rounded border text-sm transition-colors",
                    inMonth ? "text-ink" : "text-ink-faint/40",
                    isSel ? "border-vermilion bg-vermilion-soft/50" : "border-transparent hover:border-line hover:bg-paper",
                    isToday && !isSel && "border-vermilion/60"
                  )}
                >
                  <span className={cn(isToday && "font-serif font-bold text-vermilion")}>{day}</span>
                  {dayList.length > 0 && (
                    <span className="flex gap-0.5">
                      {hasTodo && <span className={cn("h-1.5 w-1.5 rounded-full", allDone ? "bg-jade" : "bg-vermilion")} />}
                      {!hasTodo && allDone && <span className="h-1.5 w-1.5 rounded-full bg-jade" />}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 当日任务列表 */}
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-serif text-sm font-semibold text-ink-soft">
              {formatShort(selected)} · {weekdayCN(selected)}
            </h2>
            {selected !== today && (
              <button onClick={() => setSelected(today)} className="text-xs text-ink-faint hover:text-vermilion">
                回今日
              </button>
            )}
          </div>
          {dayTasks.length === 0 ? (
            <EmptyState title="当日无奏折" hint="这一天没有计划或截止的任务。" />
          ) : (
            <div className="space-y-2">
              {planned.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-jade">计划当日</p>
                  <ul className="panel divide-y divide-line">
                    {planned.map((t) => (
                      <DayTaskItem key={t.id} task={t} />
                    ))}
                  </ul>
                </div>
              )}
              {dueOnly.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-gold">截止当日</p>
                  <ul className="panel divide-y divide-line">
                    {dueOnly.map((t) => (
                      <DayTaskItem key={t.id} task={t} showDue />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DayTaskItem({ task, showDue }: { task: Task; showDue?: boolean }) {
  return (
    <li>
      <Link to={`/tasks?focus=${task.id}`} className="flex items-center gap-2.5 px-3 py-2 hover:bg-paper">
        <TaskStatusBadge status={task.status} />
        <span className={cn("min-w-0 flex-1 truncate text-xs", task.status === "done" && "text-ink-faint line-through")}>
          {task.title}
        </span>
        <PriorityBadge priority={task.priority} />
        {showDue && isOverdue(task.dueDate, task.status) && <Badge tone="danger">逾期</Badge>}
        {task.status === "done" && task.completedAt && (
          <span className="text-[10px] text-ink-faint">完成 {task.completedAt.slice(5, 10)}</span>
        )}
      </Link>
    </li>
  );
}
