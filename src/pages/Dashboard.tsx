import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Star, Plus, TrendingUp, TrendingDown } from "lucide-react";
import { Badge, Button, Input, Select, EmptyState } from "@/components/ui";
import { getTodayStats, createTask } from "@/storage/repositories/taskRepo";
import { getRecentMetrics } from "@/storage/repositories/metricRepo";
import { getTopValueEntries, getAdoptionStats, type ValueEntry, type BookAdoptionStats } from "@/domain/recommend";
import { getBalanceDistribution, getWeeklyTaskStats, getWeeklyFocus, type BalanceSlice, type WeekDayStat } from "@/domain/balance";
import type { Task, Metric } from "@/storage/db";
import { todayKey, formatShort, weekdayCN } from "@/lib/date";
import { PriorityBadge } from "@/components/taskBadges";
import { lazy, Suspense } from "react";

const LazyCharts = lazy(async () => {
  const recharts = await import("recharts");
  function Charts({
    week,
    balance,
  }: {
    week: WeekDayStat[];
    balance: BalanceSlice[];
  }) {
    const { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, Legend } = recharts;
    const balanceData = balance.filter((b) => b.value > 0);
    return (
      <>
        {/* 每周任务完成情况（堆叠柱状） */}
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-sm font-semibold">每周任务完成情况</h2>
            <Badge tone="teal">近 7 天</Badge>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={week} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8A857C" }} stroke="#E5E0D5" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8A857C" }} stroke="#E5E0D5" />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E0D5" }} cursor={{ fill: "rgba(47,93,91,0.05)" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="done" name="已完成" stackId="a" fill="#2F5D5B" radius={[0, 0, 0, 0]} />
              <Bar dataKey="doing" name="进行中" stackId="a" fill="#8CA695" />
              <Bar dataKey="todo" name="待办" stackId="a" fill="#DDD6C6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {/* 人生平衡分布（环形） */}
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-sm font-semibold">人生平衡分布</h2>
            <Badge tone="neutral">按条目口径</Badge>
          </div>
          {balanceData.length === 0 || balanceData.every((b) => b.value === 0) ? (
            <p className="py-12 text-center text-xs text-ink-faint">完成关联典籍条目的任务后，这里会显示你的精力分布。</p>
          ) : (
            <div className="flex items-center">
              <ResponsiveContainer width="55%" height={190}>
                <PieChart>
                  <Pie
                    data={balanceData}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={52}
                    outerRadius={80}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {balanceData.map((b) => (
                      <Cell key={b.key} fill={b.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E0D5" }} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="flex-1 space-y-1.5 text-xs">
                {balanceData.map((b) => (
                  <li key={b.key} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: b.color }} />
                    <span className="flex-1 text-ink-soft">{b.label}</span>
                    <span className="font-medium">{b.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </>
    );
  }
  return { default: Charts };
});

export default function Dashboard() {
  const today = todayKey();
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getTodayStats>> | null>(null);
  const [adoption, setAdoption] = useState<BookAdoptionStats | null>(null);
  const [topEntries, setTopEntries] = useState<ValueEntry[] | null>(null);
  const [balance, setBalance] = useState<BalanceSlice[]>([]);
  const [week, setWeek] = useState<WeekDayStat[]>([]);
  const [focus, setFocus] = useState<Awaited<ReturnType<typeof getWeeklyFocus>> | null>(null);
  const [metrics, setMetrics] = useState<{ metric: Metric; summary: { latest: { value: number; date: string } | null; delta: number | null } }[]>([]);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickPriority, setQuickPriority] = useState<Task["priority"]>("medium");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void (async () => {
      const s = await getTodayStats();
      setStats(s);
      setAdoption(await getAdoptionStats());
      setTopEntries(await getTopValueEntries(6));
      setBalance(await getBalanceDistribution("done"));
      setWeek(await getWeeklyTaskStats());
      setFocus(await getWeeklyFocus());
      setMetrics(await getRecentMetrics(3));
    })();
  }, [today]);

  async function quickCreate() {
    if (!quickTitle.trim()) return;
    setCreating(true);
    try {
      await createTask({ title: quickTitle, priority: quickPriority, plannedDate: today });
      setQuickTitle("");
      const s = await getTodayStats();
      setStats(s);
      setWeek(await getWeeklyTaskStats());
    } finally {
      setCreating(false);
    }
  }

  const doneCount = stats?.done.length ?? 0;
  const todoCount = stats?.todo.length ?? 0;
  const todayTotal = doneCount + todoCount;
  const pct = todayTotal > 0 ? Math.round((doneCount / todayTotal) * 100) : 0;

  return (
    <div>
      {/* 大标题区（参考图 H1 风格） */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-wide lg:text-4xl">今日内政</h1>
          <p className="mt-1.5 text-sm text-ink-soft">
            {formatShort(today)} · {weekdayCN(today)} —— 将繁杂事务归于秩序，日拱一卒，自成章法。
          </p>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-ink-faint">
          <span className="rounded border border-line bg-card px-2 py-1">自律</span>
          <span className="rounded border border-line bg-card px-2 py-1">自省</span>
          <span className="rounded border border-line bg-card px-2 py-1">自成</span>
        </div>
      </div>

      {/* 快速创建 */}
      <div className="panel mb-6 flex flex-wrap items-center gap-2 p-3">
        <Plus size={16} className="ml-1 shrink-0 text-ink-faint" />
        <Input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void quickCreate()}
          placeholder="拟一道奏折（今日待办）…"
          className="min-w-40 flex-1 border-transparent bg-transparent focus:border-teal"
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
          新建要务
        </Button>
      </div>

      {/* 三张统计卡（参考图 07 卡片风格） */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* 本日要务 */}
        <section className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-sm font-semibold">本日要务</h2>
            <Link to="/tasks" className="flex items-center gap-0.5 text-xs text-ink-faint hover:text-teal">
              查看全部 <ArrowRight size={12} />
            </Link>
          </div>
          {todayTotal > 0 ? (
            <>
              <div className="mb-1 flex items-baseline gap-1">
                <span className="font-serif text-2xl font-bold">
                  今日 {doneCount}/{todayTotal} 已完成
                </span>
              </div>
              <div className="mb-3 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-teal transition-all" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-medium text-teal-deep">{pct}%</span>
              </div>
            </>
          ) : (
            <p className="mb-3 text-sm text-ink-faint">今日尚无奏折，速去拟一道。</p>
          )}
          <ul className="space-y-1.5">
            {(stats?.todo.slice(0, 3) ?? []).map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-xs">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-vermilion" />
                <Link to={`/tasks?focus=${t.id}`} className="min-w-0 flex-1 truncate hover:text-teal">
                  {t.title}
                </Link>
                <PriorityBadge priority={t.priority} />
              </li>
            ))}
            {stats && stats.overdue.length > 0 && (
              <li className="flex items-center gap-2 text-xs text-vermilion">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-vermilion" />
                <Link to="/tasks" className="flex-1 hover:underline">
                  另有 {stats.overdue.length} 件逾期待处理
                </Link>
              </li>
            )}
          </ul>
        </section>

        {/* 人生知识库（量化融合卡） */}
        <section className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-sm font-semibold">人生知识库</h2>
            <Link to="/library" className="flex items-center gap-0.5 text-xs text-ink-faint hover:text-teal">
              前往典籍 <ArrowRight size={12} />
            </Link>
          </div>
          {adoption ? (
            <>
              <div className="mb-3 flex items-baseline gap-1.5">
                <span className="font-serif text-3xl font-bold text-teal-deep">{adoption.practiced}</span>
                <span className="text-sm text-ink-soft">/ {adoption.total} 条已践行</span>
              </div>
              <div className="mb-3 h-2 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-gold transition-all"
                  style={{ width: `${Math.max(1, Math.round((adoption.practiced / Math.max(1, adoption.total)) * 100))}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="font-serif text-lg font-semibold">{adoption.inProgress}</p>
                  <p className="text-[10px] text-ink-faint">践行中</p>
                </div>
                <div>
                  <p className="font-serif text-lg font-semibold">{adoption.favorites}</p>
                  <p className="text-[10px] text-ink-faint">收藏</p>
                </div>
                <div>
                  <p className="font-serif text-lg font-semibold">
                    {adoption.gradeATotal > 0 ? Math.round((adoption.gradeAPracticed / adoption.gradeATotal) * 100) : 0}%
                  </p>
                  <p className="text-[10px] text-ink-faint">A级践行率</p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-faint">统计中……</p>
          )}
        </section>

        {/* 本周数据（参考图「本周专注时长」） */}
        <section className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-sm font-semibold">本周要务达成</h2>
            <Link to="/reviews" className="flex items-center gap-0.5 text-xs text-ink-faint hover:text-teal">
              去复盘 <ArrowRight size={12} />
            </Link>
          </div>
          {focus ? (
            <>
              <div className="mb-1 flex items-baseline gap-1.5">
                <span className="font-serif text-3xl font-bold text-teal-deep">{focus.thisWeek}</span>
                <span className="text-sm text-ink-soft">件已完成</span>
              </div>
              <p className="mb-3 flex items-center gap-1 text-xs">
                {focus.deltaPct === null ? (
                  <span className="text-ink-faint">上周无记录，本周起算</span>
                ) : focus.deltaPct >= 0 ? (
                  <>
                    <TrendingUp size={13} className="text-jade-deep" />
                    <span className="text-jade-deep">较上周提升 {focus.deltaPct}%</span>
                  </>
                ) : (
                  <>
                    <TrendingDown size={13} className="text-vermilion" />
                    <span className="text-vermilion">较上周回落 {Math.abs(focus.deltaPct)}%</span>
                  </>
                )}
              </p>
              <div className="flex items-end justify-between gap-1 pt-2">
                {week.map((d) => {
                  const max = Math.max(1, ...week.map((x) => x.done + x.doing + x.todo));
                  const h = Math.round(((d.done + d.doing) / max) * 32);
                  return (
                    <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                      <div className="flex h-8 w-full items-end justify-center">
                        {d.done + d.doing > 0 && (
                          <div className="w-3.5 rounded-t bg-jade" style={{ height: `${Math.max(3, h)}px` }} title={`${d.done + d.doing} 件`} />
                        )}
                      </div>
                      <span className="text-[9px] text-ink-faint">{d.label.slice(1)}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-faint">统计中……</p>
          )}
        </section>
      </div>

      {/* 图表行：堆叠柱 + 环形 */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Suspense fallback={<div className="panel p-5 text-xs text-ink-faint">图表加载中……</div>}>
          <LazyCharts week={week} balance={balance} />
        </Suspense>
      </div>

      {/* 高性价比行动榜（知识库有机融合核心） */}
      <section className="mb-6">
        <div className="mb-2 flex items-baseline justify-between">
          <div>
            <h2 className="font-serif text-lg font-bold">高性价比行动榜</h2>
            <p className="mt-0.5 text-xs text-ink-soft">
              从 {adoption?.total ?? 767} 条中按「证据硬度 × 收益 ÷ 成本」实时算出的当前最划算之事——不用全做，挑走一条就算数。
            </p>
          </div>
          <Link to="/library" className="shrink-0 text-xs text-ink-faint hover:text-teal">
            全部典籍 →
          </Link>
        </div>
        {!topEntries ? (
          <div className="panel p-5 text-sm text-ink-faint">计算中……</div>
        ) : topEntries.length === 0 ? (
          <EmptyState title="榜单已清空" hint="榜单条目都已建过奏折，去典籍挖掘更多吧。" />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {topEntries.map((e, i) => (
              <TopValueCard key={e.id} entry={e} rank={i + 1} onPlanned={() => void refreshAll()} />
            ))}
          </ul>
        )}
      </section>

      {/* 底部两栏：国库近况 + 今日复盘入口 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-serif text-sm font-semibold text-ink-soft">国库近况</h2>
            <Link to="/metrics" className="text-xs text-ink-faint hover:text-teal">
              数据追踪 →
            </Link>
          </div>
          {metrics.length === 0 ? (
            <EmptyState title="尚未开列指标" hint="记录体重、睡眠、开销，量化可见的变化。" />
          ) : (
            <ul className="panel divide-y divide-line/70">
              {metrics.map(({ metric, summary }) => (
                <li key={metric.id}>
                  <Link to={`/metrics?focus=${metric.id}`} className="flex items-center justify-between px-4 py-2.5 hover:bg-paper/60">
                    <span className="text-sm">{metric.name}</span>
                    <span className="flex items-baseline gap-1.5">
                      <span className="font-serif text-base font-semibold">{summary.latest?.value ?? "—"}</span>
                      <span className="text-xs text-ink-faint">{metric.unit}</span>
                      {summary.delta !== null && summary.delta !== 0 && (
                        <span className={`text-xs ${summary.delta > 0 ? "text-vermilion" : "text-jade-deep"}`}>
                          {summary.delta > 0 ? "▲" : "▼"}
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

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-serif text-sm font-semibold text-ink-soft">今日复盘</h2>
            <Link to="/reviews" className="text-xs text-ink-faint hover:text-teal">
              周期复盘 →
            </Link>
          </div>
          <Link to="/reviews" className="panel flex items-center justify-between px-4 py-4 transition-colors hover:border-teal/40">
            <div className="flex items-center gap-3">
              <span className="seal h-9 w-9 rounded-lg bg-gold-soft text-base text-gold-deep">鉴</span>
              <div>
                <p className="text-sm font-medium">回顾今日政务得失</p>
                <p className="text-xs text-ink-faint">日省一事，周理一册，月鉴一卷</p>
              </div>
            </div>
            <ArrowRight size={16} className="text-ink-faint" />
          </Link>
        </section>
      </div>
    </div>
  );

  async function refreshAll() {
    setStats(await getTodayStats());
    setAdoption(await getAdoptionStats());
    setTopEntries(await getTopValueEntries(6));
    setWeek(await getWeeklyTaskStats());
  }
}

/* ============ 高性价比行动榜单卡 ============ */

function TopValueCard({ entry, rank, onPlanned }: { entry: ValueEntry; rank: number; onPlanned: () => void }) {
  const [planned, setPlanned] = useState(false);
  const [date, setDate] = useState(todayKey());
  const [open, setOpen] = useState(false);

  async function plan() {
    await createTask({ title: entry.title, plannedDate: date || null, entryId: entry.id });
    setPlanned(true);
    setOpen(false);
    onPlanned();
  }

  return (
    <li className="panel relative overflow-hidden p-4">
      <span className="absolute left-0 top-0 h-full w-1 bg-gold" aria-hidden />
      <div className="flex items-start gap-3 pl-1.5">
        <span className="font-serif text-xl font-bold text-gold-deep/60">{String(rank).padStart(2, "0")}</span>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Badge tone="teal">证据 {entry.evidenceGrade}</Badge>
            {entry.tags.benefit === 2 && <Badge tone="vermilion">收益大</Badge>}
            {entry.tags.scope && <Badge tone="neutral">{entry.tags.scope === "死亡率" ? "保命" : entry.tags.scope}</Badge>}
            {entry.tags.money === 0 && <Badge tone="gold">不花钱</Badge>}
          </div>
          <Link to={`/library/entry/${entry.id}`} className="font-serif text-sm font-semibold leading-snug hover:text-teal">
            {entry.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">{entry.plainTalk}</p>
          <div className="mt-2.5 flex items-center gap-2">
            {planned ? (
              <Badge tone="jade">
                <Star size={10} /> 已列入奏折
              </Badge>
            ) : (
              <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
                <Plus size={12} /> 拟奏折
              </Button>
            )}
            <Link to={`/library/entry/${entry.id}`} className="text-xs text-ink-faint hover:text-teal">
              查看原文与证据 →
            </Link>
          </div>
        </div>
      </div>
      {open && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-paper/60 p-2 pl-3.5">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-36 py-1 text-xs" aria-label="计划日期" />
          <Button size="sm" variant="primary" onClick={() => void plan()}>
            确认
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            取消
          </Button>
        </div>
      )}
    </li>
  );
}
