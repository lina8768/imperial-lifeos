import { describe, it, expect } from "vitest";
import { seedBookIfNeeded, validateBundledBook } from "@/storage/bookSeed";
import { getTopValueEntries, getAdoptionStats } from "@/domain/recommend";
import { getBalanceDistribution, getWeeklyTaskStats, getWeeklyFocus } from "@/domain/balance";
import { createTask, completeTask } from "@/storage/repositories/taskRepo";
import { todayKey } from "@/lib/date";

describe("高性价比行动榜（知识库有机融合）", () => {
  it("推荐条目全部来自内置知识库且证据等级偏硬", async () => {
    await seedBookIfNeeded();
    const top = await getTopValueEntries(8);
    expect(top.length).toBe(8);
    const total = validateBundledBook().entries.length;
    for (const e of top) {
      expect(e.id).toMatch(/^ch\d{2}-e\d{3}$/);
      expect(e.score).toBeGreaterThan(0);
      expect(e.globalIndex).toBeLessThanOrEqual(total);
    }
    // Top 条目证据等级应为 A（排序权重决定）
    expect(top[0].evidenceGrade).toBe("A");
  });

  it("已建过任务的条目不再重复推荐（避免总览炒冷饭）", async () => {
    await seedBookIfNeeded();
    const before = await getTopValueEntries(5);
    const first = before[0];
    await createTask({ title: "行动", entryId: first.id });
    const after = await getTopValueEntries(5);
    expect(after.map((e) => e.id)).not.toContain(first.id);
    // 且数量仍为 5（榜单自动补位）
    expect(after.length).toBe(5);
  });

  it("践行统计：practiced / inProgress / A级践行率", async () => {
    await seedBookIfNeeded();
    const before = await getAdoptionStats();
    const top = await getTopValueEntries(2);
    // 一条完成（practiced），一条仅创建（inProgress）
    await createTask({ title: "已做", entryId: top[0].id });
    const done = await createTask({ title: "再做一次", entryId: top[0].id });
    await completeTask(done.id);
    await createTask({ title: "在做", entryId: top[1].id });
    const after = await getAdoptionStats();
    expect(after.practiced).toBe(before.practiced + 1);
    expect(after.inProgress).toBe(before.inProgress + 1);
    expect(after.gradeAPracticed).toBeLessThanOrEqual(after.gradeATotal);
  });
});

describe("人生平衡分布与周统计", () => {
  it("按条目口径归类：死亡率→健康寿命，金钱→财富管理，无关联→日常其他", async () => {
    await seedBookIfNeeded();
    // 找一条死亡率口径与一条金钱口径的条目
    const { db } = await import("@/storage/db");
    const all = await db.bookEntries.toArray();
    const death = all.find((e) => e.tags.scope === "死亡率")!;
    const money = all.find((e) => e.tags.scope === "金钱")!;

    const t1 = await createTask({ title: "保命事", entryId: death.id });
    await completeTask(t1.id);
    const t2 = await createTask({ title: "省钱事", entryId: money.id });
    await completeTask(t2.id);
    const t3 = await createTask({ title: "无关条目的事" });
    await completeTask(t3.id);

    const dist = await getBalanceDistribution("done");
    const health = dist.find((d) => d.key === "死亡率")!;
    const wealth = dist.find((d) => d.key === "金钱")!;
    const other = dist.find((d) => d.key === "_other")!;
    expect(health.value).toBeGreaterThanOrEqual(1);
    expect(wealth.value).toBeGreaterThanOrEqual(1);
    expect(other.value).toBeGreaterThanOrEqual(1);
    expect(dist.length).toBe(5);
  });

  it("近 7 天堆叠数据：已完成按完成日计", async () => {
    await seedBookIfNeeded();
    const t = await createTask({ title: "今日完成事", plannedDate: todayKey() });
    await completeTask(t.id);
    const week = await getWeeklyTaskStats();
    expect(week.length).toBe(7);
    expect(week[6].date).toBe(todayKey());
    expect(week[6].done).toBeGreaterThanOrEqual(1);
    expect(week.reduce((n, d) => n + d.done + d.doing + d.todo, 0)).toBeGreaterThanOrEqual(1);
  });

  it("本周达成统计含环比", async () => {
    const t = await createTask({ title: "本周事", plannedDate: todayKey() });
    await completeTask(t.id);
    const focus = await getWeeklyFocus();
    expect(focus.thisWeek).toBeGreaterThanOrEqual(1);
  });
});
