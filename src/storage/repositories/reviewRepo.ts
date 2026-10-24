import { db, type Review, type ReviewPeriod, type ReviewAction, type Task } from "@/storage/db";
import { uuid, nowISO, todayKey, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, addMonths } from "@/lib/date";
import { createTask, listTasks } from "./taskRepo";
import { listMetrics, listRecords, getMetricSummary } from "./metricRepo";

export interface PeriodRange {
  startDate: string;
  endDate: string;
}

/** 计算某日期所属周期范围 */
export function getPeriodRange(period: ReviewPeriod, anchor = todayKey()): PeriodRange {
  switch (period) {
    case "daily":
      return { startDate: anchor, endDate: anchor };
    case "weekly":
      return { startDate: startOfWeek(anchor), endDate: endOfWeek(anchor) };
    case "monthly":
      return { startDate: startOfMonth(anchor), endDate: endOfMonth(anchor) };
    case "yearly":
      return { startDate: startOfYear(anchor), endDate: endOfYear(anchor) };
  }
}

/** 从某周期锚点移动 n 步 */
export function shiftPeriod(period: ReviewPeriod, anchor: string, steps: number): string {
  switch (period) {
    case "daily":
      return addDays(anchor, steps);
    case "weekly":
      return addDays(anchor, steps * 7);
    case "monthly":
      return addMonths(anchor, steps);
    case "yearly": {
      const d = new Date(Number(anchor.slice(0, 4)) + steps, Number(anchor.slice(5, 7)) - 1, Number(anchor.slice(8, 10)));
      return `${d.getFullYear()}-${anchor.slice(4)}`;
    }
  }
}

export async function findReview(period: ReviewPeriod, range: PeriodRange): Promise<Review | undefined> {
  const rows = await db.reviews.where("periodType").equals(period).toArray();
  return rows.find((r) => r.startDate === range.startDate && r.endDate === range.endDate);
}

export async function saveReview(period: ReviewPeriod, range: PeriodRange, content: string): Promise<Review> {
  const existing = await findReview(period, range);
  const now = nowISO();
  if (existing) {
    const next: Review = { ...existing, content, updatedAt: now };
    await db.reviews.put(next);
    return next;
  }
  const review: Review = {
    id: uuid(),
    periodType: period,
    startDate: range.startDate,
    endDate: range.endDate,
    content,
    createdAt: now,
    updatedAt: now,
  };
  await db.reviews.add(review);
  return review;
}

export async function listReviews(period?: ReviewPeriod): Promise<Review[]> {
  const rows = period ? await db.reviews.where("periodType").equals(period).toArray() : await db.reviews.toArray();
  return rows.sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export interface PeriodStats {
  total: number;
  done: number;
  cancelled: number;
  completionRate: number; // 0~1（已完成 / 非取消）
  doneTasks: Task[];
}

/** 周期内任务完成情况（按 plannedDate 落在区间内，含截止日落在区间内的逾期任务） */
export async function getPeriodStats(range: PeriodRange): Promise<PeriodStats> {
  const all = await listTasks({});
  const inRange = all.filter((t) => {
    const planned = t.plannedDate;
    const due = t.dueDate;
    return (
      (planned !== null && planned >= range.startDate && planned <= range.endDate) ||
      (due !== null && due >= range.startDate && due <= range.endDate)
    );
  });
  const done = inRange.filter((t) => t.status === "done");
  const cancelled = inRange.filter((t) => t.status === "cancelled");
  const effective = inRange.length - cancelled.length;
  return {
    total: inRange.length,
    done: done.length,
    cancelled: cancelled.length,
    completionRate: effective > 0 ? done.length / effective : 0,
    doneTasks: done,
  };
}

export interface MetricTrend {
  metricId: string;
  name: string;
  unit: string;
  first: number | null;
  last: number | null;
  delta: number | null;
  count: number;
}

/** 周期内指标趋势（每个指标独立，不跨指标合并计算） */
export async function getPeriodMetricTrends(range: PeriodRange): Promise<MetricTrend[]> {
  const metrics = await listMetrics();
  const trends: MetricTrend[] = [];
  for (const m of metrics) {
    const rows = await listRecords(m.id, { start: range.startDate, end: range.endDate });
    if (!rows.length) continue;
    const first = rows[0].value;
    const last = rows[rows.length - 1].value;
    trends.push({
      metricId: m.id,
      name: m.name,
      unit: m.unit,
      first,
      last,
      delta: last - first,
      count: rows.length,
    });
  }
  return trends;
}

/** 将复盘结论转化为新任务 */
export async function createReviewAction(review: Review, title: string, extra?: {
  description?: string;
  priority?: Task["priority"];
  plannedDate?: string | null;
}): Promise<{ action: ReviewAction; task: Task }> {
  const task = await createTask({
    title,
    description: extra?.description ?? `来自复盘（${review.startDate} ~ ${review.endDate}）`,
    priority: extra?.priority ?? "medium",
    plannedDate: extra?.plannedDate ?? null,
  });
  const action: ReviewAction = {
    id: uuid(),
    reviewId: review.id,
    taskId: task.id,
    createdAt: nowISO(),
  };
  await db.reviewActions.add(action);
  return { action, task };
}

export async function getReviewActions(reviewId: string): Promise<(ReviewAction & { task?: Task })[]> {
  const actions = await db.reviewActions.where("reviewId").equals(reviewId).toArray();
  const result = [];
  for (const a of actions) {
    const task = await db.tasks.get(a.taskId);
    result.push({ ...a, task });
  }
  return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 最近指标摘要（总览页用） */
export { getMetricSummary };
