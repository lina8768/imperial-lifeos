import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Trash2, ExternalLink } from "lucide-react";
import { PageHeader, Button, Textarea, EmptyState } from "@/components/ui";
import { ConfirmDialog } from "@/components/Dialog";
import {
  getPeriodRange, shiftPeriod, findReview, saveReview, listReviews,
  getPeriodStats, getPeriodMetricTrends, createReviewAction, getReviewActions,
  type PeriodStats, type MetricTrend, type PeriodRange,
} from "@/storage/repositories/reviewRepo";
import { deleteTask } from "@/storage/repositories/taskRepo";
import type { Review, ReviewPeriod, Task } from "@/storage/db";
import { todayKey, formatShort, weekdayCN } from "@/lib/date";
import { cn } from "@/lib/utils";

const PERIOD_LABELS: Record<ReviewPeriod, string> = {
  daily: "日",
  weekly: "周",
  monthly: "月",
  yearly: "年",
};

export default function ReviewsPage() {
  const [period, setPeriod] = useState<ReviewPeriod>("daily");
  const [anchor, setAnchor] = useState(todayKey());
  const [review, setReview] = useState<Review | null>(null);
  const [content, setContent] = useState("");
  const [stats, setStats] = useState<PeriodStats | null>(null);
  const [trends, setTrends] = useState<MetricTrend[]>([]);
  const [actionInput, setActionInput] = useState("");
  const [actions, setActions] = useState<(Awaited<ReturnType<typeof getReviewActions>>[number])[]>([]);
  const [history, setHistory] = useState<Review[]>([]);
  const [deletingAction, setDeletingAction] = useState<Task | null>(null);

  const range: PeriodRange = useMemo(() => getPeriodRange(period, anchor), [period, anchor]);
  const isCurrent = useMemo(() => {
    const cur = getPeriodRange(period);
    return cur.startDate === range.startDate;
  }, [period, range]);

  useEffect(() => {
    void (async () => {
      const r = await findReview(period, range);
      setReview(r ?? null);
      setContent(r?.content ?? "");
      setStats(await getPeriodStats(range));
      setTrends(await getPeriodMetricTrends(range));
      setActions(r ? await getReviewActions(r.id) : []);
    })();
  }, [period, range.startDate, range.endDate]);

  useEffect(() => {
    void listReviews(period).then(setHistory);
  }, [period, review]);

  const rangeLabel =
    period === "daily"
      ? `${formatShort(range.startDate)} · ${weekdayCN(range.startDate)}`
      : `${formatShort(range.startDate)} ~ ${formatShort(range.endDate)}`;

  async function save() {
    const r = await saveReview(period, range, content);
    setReview(r);
    setHistory(await listReviews(period));
  }

  async function addAction() {
    if (!review || !actionInput.trim()) return;
    await createReviewAction(review, actionInput);
    setActionInput("");
    setActions(await getReviewActions(review.id));
    setStats(await getPeriodStats(range));
  }

  async function removeAction(task: Task) {
    if (!review) return;
    const { db } = await import("@/storage/db");
    await db.reviewActions.where("taskId").equals(task.id).delete();
    await deleteTask(task.id);
    setActions(await getReviewActions(review.id));
    setStats(await getPeriodStats(range));
  }

  return (
    <div>
      <PageHeader title="治理复盘" subtitle="日省、周省、月省、年省" />

      {/* 周期切换 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded border border-line bg-card p-0.5">
          {(Object.keys(PERIOD_LABELS) as ReviewPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p);
                setAnchor(todayKey());
              }}
              className={cn(
                "rounded px-3.5 py-1 text-sm transition-colors",
                period === p ? "bg-vermilion text-white" : "text-ink-soft hover:text-ink"
              )}
            >
              {PERIOD_LABELS[p]}复盘
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button aria-label="上一周期" onClick={() => setAnchor(shiftPeriod(period, anchor, -1))} className="rounded p-1.5 text-ink-soft hover:bg-paper">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-40 text-center text-sm font-medium">{rangeLabel}</span>
          <button
            aria-label="下一周期"
            onClick={() => setAnchor(shiftPeriod(period, anchor, 1))}
            disabled={isCurrent}
            className="rounded p-1.5 text-ink-soft hover:bg-paper disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
          {!isCurrent && (
            <button onClick={() => setAnchor(todayKey())} className="ml-1 text-xs text-ink-faint hover:text-vermilion">
              回当前
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <div>
          {/* 周期统计 */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatBox label="周期内任务" value={stats?.total ?? "…"} />
            <StatBox label="已成" value={stats?.done ?? "…"} tone="jade" />
            <StatBox label="已撤" value={stats?.cancelled ?? "…"} tone="gray" />
            <StatBox
              label="完成率"
              value={stats ? `${Math.round(stats.completionRate * 100)}%` : "…"}
              tone="vermilion"
            />
          </div>

          {/* 指标趋势 */}
          {trends.length > 0 && (
            <section className="panel mb-4 p-4">
              <h3 className="mb-2 font-serif text-sm font-semibold text-ink-soft">周期内指标趋势</h3>
              <ul className="divide-y divide-line/60">
                {trends.map((t) => (
                  <li key={t.metricId} className="flex items-center justify-between py-1.5">
                    <Link to={`/metrics?focus=${t.metricId}`} className="text-sm hover:text-vermilion">
                      {t.name}
                    </Link>
                    <span className="flex items-baseline gap-1 text-xs">
                      <span className="text-ink-faint">{t.first} → </span>
                      <span className="font-serif text-sm font-semibold">{t.last}</span>
                      <span className="text-ink-faint">{t.unit}</span>
                      {t.delta !== null && t.delta !== 0 && (
                        <span className={cn(t.delta > 0 ? "text-vermilion" : "text-jade")}>
                          {t.delta > 0 ? "▲" : "▼"}
                          {Math.abs(t.delta)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 复盘编辑器 */}
          <section className="panel p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-serif text-sm font-semibold text-ink-soft">
                {review ? "编辑复盘" : "撰写复盘"}
                {review && <span className="ml-2 text-[11px] font-normal text-ink-faint">上次更新 {review.updatedAt.slice(0, 10)}</span>}
              </h3>
              <Button size="sm" variant="primary" onClick={() => void save()}>
                保存
              </Button>
            </div>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="这周期做了什么、什么做得好、什么要改……"
              className="min-h-48 font-serif leading-8"
              aria-label="复盘内容"
            />

            {/* 复盘行动 */}
            <div className="mt-4 border-t border-line pt-3">
              <h4 className="mb-2 text-xs font-medium text-ink-soft">复盘行动 → 转为奏折</h4>
              {actions.length > 0 && (
                <ul className="mb-2 space-y-1">
                  {actions.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 rounded border border-line bg-paper px-2.5 py-1.5">
                      <ExternalLink size={12} className="shrink-0 text-ink-faint" />
                      <Link to={`/tasks?focus=${a.taskId}`} className="min-w-0 flex-1 truncate text-xs hover:text-vermilion">
                        {a.task?.title ?? "（任务已删除）"}
                      </Link>
                      <button
                        aria-label="删除该行动"
                        onClick={() => a.task && setDeletingAction(a.task)}
                        className="shrink-0 rounded p-1 text-ink-faint hover:text-danger"
                      >
                        <Trash2 size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!review ? (
                <p className="text-[11px] text-ink-faint">先保存复盘，再把结论转为行动任务。</p>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={actionInput}
                    onChange={(e) => setActionInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void addAction()}
                    placeholder="下周期要做的改变…"
                    className="field py-1.5 text-xs"
                  />
                  <Button size="sm" onClick={() => void addAction()} disabled={!actionInput.trim()}>
                    <Plus size={12} /> 转奏折
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* 历史复盘 */}
        <aside>
          <h3 className="mb-2 font-serif text-sm font-semibold text-ink-soft">
            历{PERIOD_LABELS[period]}复盘
          </h3>
          {history.length === 0 ? (
            <EmptyState title="暂无历史复盘" hint={`保存第一篇${PERIOD_LABELS[period]}复盘后显示在这里。`} />
          ) : (
            <ul className="panel max-h-[36rem] divide-y divide-line overflow-y-auto">
              {history.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setAnchor(r.startDate)}
                    className={cn(
                      "w-full px-3 py-2 text-left hover:bg-paper",
                      r.startDate === range.startDate && "bg-vermilion-soft/40"
                    )}
                  >
                    <p className="text-xs font-medium">
                      {r.periodType === "daily"
                        ? formatShort(r.startDate)
                        : `${formatShort(r.startDate)} ~ ${formatShort(r.endDate)}`}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-faint">
                      {r.content.replace(/\n/g, " ").slice(0, 40) || "（空）"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <ConfirmDialog
        open={!!deletingAction}
        onOpenChange={(o) => !o && setDeletingAction(null)}
        title="删除该复盘行动？"
        description={deletingAction ? `任务「${deletingAction.title}」将一并删除。` : undefined}
        confirmLabel="确认删除"
        danger
        onConfirm={async () => {
          if (deletingAction) await removeAction(deletingAction);
          setDeletingAction(null);
        }}
      />
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number | string; tone?: "jade" | "vermilion" | "gray" }) {
  const tones = { jade: "text-jade", vermilion: "text-vermilion", gray: "text-ink-faint" };
  return (
    <div className="panel px-4 py-3">
      <p className="text-[11px] text-ink-soft">{label}</p>
      <p className={cn("font-serif text-xl font-semibold", tone ? tones[tone] : "text-ink")}>{value}</p>
    </div>
  );
}
