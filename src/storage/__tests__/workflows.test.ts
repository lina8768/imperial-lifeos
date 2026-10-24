import { describe, it, expect } from "vitest";
import { createMetric, addRecord, updateRecord, deleteRecord, listRecords, getMetricSummary, deleteMetric } from "@/storage/repositories/metricRepo";
import { getJournal, saveJournal, listJournals } from "@/storage/repositories/journalRepo";
import { getPeriodRange, getPeriodStats, saveReview, findReview, createReviewAction, getReviewActions } from "@/storage/repositories/reviewRepo";
import { exportAll, parseBackup, restoreBackup } from "@/storage/repositories/backupService";
import { createTask, completeTask } from "@/storage/repositories/taskRepo";
import { todayKey, addDays } from "@/lib/date";

describe("指标记录", () => {
  it("创建指标、添加记录、同日覆盖、趋势摘要", async () => {
    const m = await createMetric({ name: "体重", unit: "kg", dataType: "number", frequency: "daily" });
    const today = todayKey();

    await addRecord(m.id, today, 72.5);
    await addRecord(m.id, addDays(today, 1), 72.1);
    // 同一天再记一笔 → 覆盖
    await addRecord(m.id, addDays(today, 1), 71.8);

    const records = await listRecords(m.id);
    expect(records.length).toBe(2);
    expect(records[1].value).toBe(71.8);

    const summary = await getMetricSummary(m.id);
    expect(summary.latest?.value).toBe(71.8);
    expect(summary.delta).toBeCloseTo(71.8 - 72.5);
  });

  it("布尔指标拒绝非 0/1 值", async () => {
    const m = await createMetric({ name: "今日锻炼", unit: "次", dataType: "boolean", frequency: "daily" });
    await expect(addRecord(m.id, todayKey(), 5)).rejects.toThrow();
    await addRecord(m.id, todayKey(), 1);
    const records = await listRecords(m.id);
    expect(records[0].value).toBe(1);
  });

  it("修改与删除记录", async () => {
    const m = await createMetric({ name: "睡眠", unit: "小时", dataType: "duration", frequency: "daily" });
    const r = await addRecord(m.id, todayKey(), 7);
    await updateRecord(r.id, { value: 7.5 });
    expect((await listRecords(m.id))[0].value).toBe(7.5);
    await deleteRecord(r.id);
    expect((await listRecords(m.id)).length).toBe(0);
  });

  it("删除指标同时清除记录", async () => {
    const m = await createMetric({ name: "开销", unit: "元", dataType: "money", frequency: "monthly" });
    await addRecord(m.id, todayKey(), 3000);
    await deleteMetric(m.id);
    expect((await listRecords(m.id)).length).toBe(0);
  });
});

describe("起居注", () => {
  it("按日期保存与更新", async () => {
    const d = todayKey();
    await saveJournal(d, "第一天");
    await saveJournal(d, "第一天（改）");
    const j = await getJournal(d);
    expect(j?.content).toBe("第一天（改）");
    const list = await listJournals();
    expect(list.length).toBe(1);
  });
});

describe("治理复盘", () => {
  it("周期范围计算", () => {
    const daily = getPeriodRange("daily", "2026-10-24");
    expect(daily).toEqual({ startDate: "2026-10-24", endDate: "2026-10-24" });
    const weekly = getPeriodRange("weekly", "2026-10-24");
    // 2026-10-24 是周六，周一为 2026-10-19
    expect(weekly).toEqual({ startDate: "2026-10-19", endDate: "2026-10-25" });
    const monthly = getPeriodRange("monthly", "2026-10-24");
    expect(monthly).toEqual({ startDate: "2026-10-01", endDate: "2026-10-31" });
    const yearly = getPeriodRange("yearly", "2026-10-24");
    expect(yearly).toEqual({ startDate: "2026-01-01", endDate: "2026-12-31" });
  });

  it("保存复盘、查找、编辑历史复盘并转化为行动任务", async () => {
    const range = getPeriodRange("weekly");
    await saveReview("weekly", range, "本周完成度一般");
    // 再次保存同一周期 → 更新而非新建
    await saveReview("weekly", range, "本周完成度一般（修订）");
    const r = await findReview("weekly", range);
    expect(r?.content).toBe("本周完成度一般（修订）");

    // 周期内任务统计
    const t = await createTask({ title: "装报警器", plannedDate: range.startDate });
    await completeTask(t.id);
    const stats = await getPeriodStats(range);
    expect(stats.done).toBe(1);
    expect(stats.total).toBe(1);

    // 复盘行动
    const { task } = await createReviewAction(r!, "下周完成燃气软管更换");
    const actions = await getReviewActions(r!.id);
    expect(actions.length).toBe(1);
    expect(actions[0].taskId).toBe(task.id);
    expect(task.title).toBe("下周完成燃气软管更换");
  });
});

describe("备份导入导出往返", () => {
  it("导出 → 清库 → 导入恢复 → 数据一致", async () => {
    // 准备数据
    const t = await createTask({ title: "往返测试任务", plannedDate: todayKey() });
    await completeTask(t.id);
    const m = await createMetric({ name: "往返指标", unit: "个", dataType: "count", frequency: "daily" });
    await addRecord(m.id, todayKey(), 3);
    await saveJournal(todayKey(), "往返日志");
    await saveReview("daily", getPeriodRange("daily"), "往返复盘");

    const backup = await exportAll();
    const json = JSON.stringify(backup);

    // 清空个人数据表（模拟数据丢失）
    const { db } = await import("@/storage/db");
    await Promise.all(
      [db.tasks, db.taskLogs, db.metrics, db.metricRecords, db.dailyJournals, db.reviews, db.reviewActions, db.entryFavorites, db.appSettings].map((tb) => tb.clear())
    );
    expect(await db.tasks.count()).toBe(0);

    // 导入恢复
    const preview = await parseBackup(json);
    expect(preview.counts.tasks).toBe(1);
    await restoreBackup(preview.backup);

    expect(await db.tasks.count()).toBe(1);
    expect((await db.tasks.toArray())[0].title).toBe("往返测试任务");
    expect((await db.dailyJournals.get(todayKey()))?.content).toBe("往返日志");
    expect((await db.reviews.toArray()).length).toBe(1);

    // 再导出一次，内容一致（除时间戳）
    const backup2 = await exportAll();
    expect(backup2.data.tasks.length).toBe(backup.data.tasks.length);
    expect(backup2.data.metricRecords.length).toBe(backup.data.metricRecords.length);
  });

  it("非法备份被 Zod 拦截", async () => {
    await expect(parseBackup("{}")).rejects.toThrow("校验失败");
    await expect(parseBackup("不是json")).rejects.toThrow("JSON");
    // 缺少 data 字段 → 校验失败
    await expect(
      parseBackup(JSON.stringify({ app: "imperial-lifeos", schemaVersion: 1, exportedAt: new Date().toISOString() }))
    ).rejects.toThrow("校验失败");
    // data 字段不完整（缺 reviews） → 校验失败
    await expect(
      parseBackup(JSON.stringify({ app: "imperial-lifeos", schemaVersion: 1, exportedAt: new Date().toISOString(), data: { tasks: [], taskLogs: [], metrics: [], metricRecords: [], journals: [], reviewActions: [], entryFavorites: [], appSettings: [] } }))
    ).rejects.toThrow();
  });

  it("高版本备份被拒绝", async () => {
    const bad = JSON.stringify({
      app: "imperial-lifeos",
      schemaVersion: 999,
      exportedAt: new Date().toISOString(),
      data: { tasks: [], taskLogs: [], metrics: [], metricRecords: [], journals: [], reviews: [], reviewActions: [], entryFavorites: [], appSettings: [] },
    });
    await expect(parseBackup(bad)).rejects.toThrow("高于当前应用");
  });
});
