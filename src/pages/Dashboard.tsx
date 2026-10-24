import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ChevronRight, AlertCircle, CheckCircle2, ListTodo } from "lucide-react";
import { PageHeader, Badge, Button, Input, Select, EmptyState } from "@/components/ui";
import { getTodayStats, createTask } from "@/storage/repositories/taskRepo";
import { getRecentMetrics } from "@/storage/repositories/metricRepo";
import { getRecentlyUsed } from "@/storage/repositories/libraryRepo";
import { findReview, getPeriodRange } from "@/storage/repositories/reviewRepo";
import { getJournal } from "@/storage/repositories/journalRepo";
import type { Task, BookEntry, Metric } from "@/storage/db";
import { todayKey, formatShort, weekdayCN, isOverdue } from "@/lib/date";
import { TaskStatusBadge, PriorityBadge } from "@/components/taskBadges";

export default function Dashboard() {
  const today = todayKey();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getTodayStats>> | null>(null);
  const [metrics, setMetrics] = useState<{ metric: Metric; summary: { latest: { value: number; date: string } | null; delta: number | null } }[]>([]);
  const [entries, setEntries] = useState<BookEntry[]>([]);
  const [hasReview, setHasReview] = useState(false);
  const [hasJournal, setHasJournal] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickPriority, setQuickPriority] = useState<Task["priority"]>("medium");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void (async () => {
      setStats(await getTodayStats());
      setMetrics(await getRecentMetrics(3));
      setEntries(await getRecentlyUsed(4));
      setHasReview(!!(await findReview("daily", getPeriodRange("daily"))));
      setHasJournal(!!(await getJournal(today)));
    })();
  }, [today]);

  async function quickCreate() {
    if (!quickTitle.trim()) return;
    setCreating(true);
    try {
      await createTask({ title: quickTitle, priority: quickPriority, plannedDate: today });
      setQuickTitle("");
      setStats(await getTodayStats());
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="御前总览"
        subtitle={`${formatShort(today)} · ${weekdayCN(today)}`}
      />

      {/* 快速创建 */}
      <div className="panel mb-6 flex flex-wrap items-center gap-2 p-3">
        <Plus size={16} className="ml-1 shrink-0 text-ink-faint" />
        <Input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void quickCreate()}
          placeholder="拟一道奏折（今日待办）…"
          className="min-w-40 flex-1 border-transparent bg-transparent focus:border-vermilion"
          aria-label="快速创建任务"
        />
        <Select
          value={quickPriority}
          onChange={(e) => setQuickPriority(e.target.value as Task["priority"])}
          className="w-24"
          aria-label="优先级"
        >
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="urgent">紧急</option>
        </Select>
        <Button variant="primary" onClick={() => void quickCreate()} disabled={creating || !quickTitle.trim()}>
          落笔
        </Button>
      </div>

      {/* 三块统计 */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<ListTodo size={16} />}
          label="今日待办"
          value={stats?.todo.length ?? "…"}
          tone="ink"
          empty={stats !== null && stats.todo.length === 0}
        />
        <StatCard
          icon={<CheckCircle2 size={16} />}
          label="今日已成"
          value={stats?.done.length ?? "…"}
          tone="jade"
          empty={stats !== null && stats.done.length === 0}
        />
        <StatCard
          icon={<AlertCircle size={16} />}
          label="逾期待处理"
          value={stats?.overdue.length ?? "…"}
          tone={stats && stats.overdue.length > 0 ? "vermilion" : "ink"}
          empty={stats !== null && stats.overdue.length === 0}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 今日任务列表 */}
        <section>
          <SectionHeader to="/tasks" title="今日奏折" />
          {!stats ? (
            <p className="p-4 text-sm text-ink-faint">加载中……</p>
          ) : stats.todayTasks.length === 0 && stats.overdue.length === 0 ? (
            <EmptyState title="今日尚无奏折" hint="用上方输入框快速拟一道，或前往「奏折与政务」详拟。" />
          ) : (
            <ul className="panel divide-y divide-line">
              {[...stats.overdue, ...stats.todayTasks.filter((t) => !stats.overdue.includes(t))].map((t) => (
                <li key={t.id}>
                  <Link to={`/tasks?focus=${t.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper">
                    <TaskStatusBadge status={t.status} />
                    <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                    {isOverdue(t.dueDate, t.status) && (
                      <Badge tone="danger">逾期</Badge>
                    )}
                    <PriorityBadge priority={t.priority} />
                    <ChevronRight size={14} className="shrink-0 text-ink-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          {/* 复盘入口 */}
          <section>
            <SectionHeader to="/reviews" title="今日复盘" />
            <Link
              to="/reviews"
              className="panel flex items-center justify-between px-4 py-3 hover:border-vermilion/40"
            >
              <div className="flex items-center gap-3">
                <div className="seal h-8 w-8 border-gold bg-gold-soft text-gold">鉴</div>
                <div>
                  <p className="text-sm font-medium">{hasReview ? "今日复盘已落笔，点击查看" : "开始今日复盘"}</p>
                  <p className="text-xs text-ink-faint">{hasJournal ? "起居注已记 · " : ""}回顾今日政务得失</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-ink-faint" />
            </Link>
          </section>

          {/* 最近指标 */}
          <section>
            <SectionHeader to="/metrics" title="国库近况" />
            {metrics.length === 0 ? (
              <EmptyState title="尚未开列指标" hint="前往「国库与国情」创建体重、开销等待办指标。" />
            ) : (
              <ul className="panel divide-y divide-line">
                {metrics.map(({ metric, summary }) => (
                  <li key={metric.id}>
                    <Link to={`/metrics?focus=${metric.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-paper">
                      <span className="text-sm">{metric.name}</span>
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-serif text-base font-semibold">{summary.latest?.value ?? "—"}</span>
                        <span className="text-xs text-ink-faint">{metric.unit}</span>
                        {summary.delta !== null && (
                          <span className={`text-xs ${summary.delta > 0 ? "text-vermilion" : summary.delta < 0 ? "text-jade" : "text-ink-faint"}`}>
                            {summary.delta > 0 ? "▲" : summary.delta < 0 ? "▼" : "—"}
                            {Math.abs(summary.delta)}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 最近使用的知识条目 */}
          <section>
            <SectionHeader to="/library" title="近览典籍" />
            {entries.length === 0 ? (
              <EmptyState title="尚未翻阅典籍" hint="前往「内政典籍」查阅《高性价比人生指南》767 条。" />
            ) : (
              <ul className="panel divide-y divide-line">
                {entries.map((e) => (
                  <li key={e.id}>
                    <Link to={`/library/entry/${e.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-paper">
                      <Badge tone="gold">{e.evidenceGrade}</Badge>
                      <span className="min-w-0 flex-1 truncate text-sm">{e.title}</span>
                      <ChevronRight size={14} className="shrink-0 text-ink-faint" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tone, empty }: { icon: React.ReactNode; label: string; value: number | string; tone: "ink" | "jade" | "vermilion"; empty: boolean }) {
  const tones = {
    ink: "text-ink",
    jade: "text-jade",
    vermilion: "text-vermilion",
  };
  return (
    <div className="panel flex items-center gap-4 p-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-paper text-ink-soft">
        {icon}
      </div>
      <div>
        <p className="text-xs text-ink-soft">{label}</p>
        <p className={`font-serif text-2xl font-semibold leading-tight ${tones[tone]}`}>
          {value}
          {empty && <span className="ml-1 text-xs font-normal text-ink-faint">皆备</span>}
        </p>
      </div>
    </div>
  );
}

function SectionHeader({ title, to }: { title: string; to: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="font-serif text-sm font-semibold tracking-wide text-ink-soft">{title}</h2>
      <Link to={to} className="text-xs text-ink-faint hover:text-vermilion">
        查看全部 →
      </Link>
    </div>
  );
}
