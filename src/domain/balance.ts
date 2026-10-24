import { db } from "@/storage/db";
import { todayKey, toDateKey, addDays } from "@/lib/date";

/**
 * 人生平衡分布：按上游「口径」把已完成（或进行中）任务归入四大维度，
 * 无关联条目的任务计入「日常其他」。参考总览页环形图。
 */
export const BALANCE_DIMS = [
  { key: "死亡率", label: "健康寿命", color: "#2F5D5B" },
  { key: "金钱", label: "财富管理", color: "#D4C19A" },
  { key: "时间", label: "时间效率", color: "#8CA695" },
  { key: "自由", label: "人身自由", color: "#B44D3C" },
  { key: "_other", label: "日常其他", color: "#C9C2B2" },
] as const;

export interface BalanceSlice {
  key: string;
  label: string;
  color: string;
  value: number;
}

/** 基于任务状态计算平衡分布。mode=done 只算已完成，all 算全部非取消任务 */
export async function getBalanceDistribution(mode: "done" | "all" = "done"): Promise<BalanceSlice[]> {
  const [tasks, entries] = await Promise.all([db.tasks.toArray(), db.bookEntries.toArray()]);
  const scopeOf = new Map(entries.map((e) => [e.id, e.tags.scope ?? null]));
  const counts = new Map<string, number>(BALANCE_DIMS.map((d) => [d.key, 0]));
  for (const t of tasks) {
    if (t.deletedAt) continue;
    if (t.status === "cancelled") continue;
    if (mode === "done" && t.status !== "done") continue;
    const scope = t.entryId ? scopeOf.get(t.entryId) ?? null : null;
    const key = scope && counts.has(scope) ? scope : "_other";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return BALANCE_DIMS.map((d) => ({
    key: d.key,
    label: d.label,
    color: d.color,
    value: counts.get(d.key) ?? 0,
  }));
}

export interface WeekDayStat {
  date: string;
  label: string; // 周一…
  done: number;
  doing: number;
  todo: number;
}

const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

/**
 * 近 7 天任务完成情况（堆叠柱状图数据）：
 * - 已完成：按 completedAt 的本地日期计
 * - 进行中/待办：按 plannedDate（或 dueDate 兜底）计
 */
export async function getWeeklyTaskStats(): Promise<WeekDayStat[]> {
  const tasks = (await db.tasks.toArray()).filter((t) => !t.deletedAt && t.status !== "cancelled");
  const today = todayKey();
  const days: WeekDayStat[] = [];
  for (let i = 6; i >= 0; i--) {
    const key = addDays(today, -i);
    days.push({ date: key, label: WEEK[new Date(key + "T00:00:00").getDay()], done: 0, doing: 0, todo: 0 });
  }
  const index = new Map(days.map((d) => [d.date, d]));
  for (const t of tasks) {
    if (t.status === "done" && t.completedAt) {
      const day = index.get(toDateKey(new Date(t.completedAt)));
      if (day) day.done += 1;
    } else {
      const plan = t.plannedDate ?? t.dueDate;
      if (plan && plan >= days[0].date && plan <= today) {
        const day = index.get(plan);
        if (day) {
          if (t.status === "doing") day.doing += 1;
          else day.todo += 1;
        }
      }
    }
  }
  return days;
}

/** 本周专注统计卡：本周完成任务数 + 环比上周 */
export async function getWeeklyFocus(): Promise<{ thisWeek: number; lastWeek: number; deltaPct: number | null }> {
  const tasks = (await db.tasks.toArray()).filter(
    (t) => !t.deletedAt && t.status === "done" && t.completedAt
  );
  const today = todayKey();
  const weekStart = addDays(today, -6);
  const lastStart = addDays(today, -13);
  let thisWeek = 0;
  let lastWeek = 0;
  for (const t of tasks) {
    const d = toDateKey(new Date(t.completedAt as string));
    if (d >= weekStart && d <= today) thisWeek += 1;
    else if (d >= lastStart && d < weekStart) lastWeek += 1;
  }
  return {
    thisWeek,
    lastWeek,
    deltaPct: lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : thisWeek > 0 ? 100 : null,
  };
}
