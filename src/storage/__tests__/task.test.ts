import { describe, it, expect } from "vitest";
import {
  createTask, updateTask, completeTask, cancelTask, deleteTask,
  getSubtasks, getSubtaskProgress, listTasks, getTaskLogs, addTaskNote, getTodayStats,
} from "@/storage/repositories/taskRepo";
import { db } from "@/storage/db";
import { todayKey, addDays } from "@/lib/date";

describe("任务 CRUD 与状态", () => {
  it("创建、读取、更新任务", async () => {
    const t = await createTask({ title: "量血压", priority: "high", plannedDate: todayKey() });
    expect(t.title).toBe("量血压");
    expect(t.status).toBe("todo");

    const updated = await updateTask(t.id, { title: "量血压并记录", status: "doing" });
    expect(updated.title).toBe("量血压并记录");
    expect(updated.status).toBe("doing");

    const logs = await getTaskLogs(t.id);
    expect(logs.some((l) => l.type === "status" && l.toStatus === "doing")).toBe(true);
  });

  it("空标题抛错", async () => {
    await expect(createTask({ title: "  " })).rejects.toThrow();
  });

  it("完成任务记录 completedAt，并写入状态日志", async () => {
    const t = await createTask({ title: "查空腹血糖" });
    const { task } = await completeTask(t.id);
    expect(task.status).toBe("done");
    expect(task.completedAt).not.toBeNull();
    const logs = await getTaskLogs(t.id);
    expect(logs.some((l) => l.toStatus === "done")).toBe(true);
  });

  it("周期任务完成后生成下一实例", async () => {
    const t = await createTask({ title: "每周复盘", recurrence: "weekly", plannedDate: todayKey() });
    const { next } = await completeTask(t.id);
    expect(next).toBeDefined();
    expect(next!.plannedDate).toBe(addDays(todayKey(), 7));
    expect(next!.recurrence).toBe("weekly");
  });

  it("取消与软删除", async () => {
    const t = await createTask({ title: "买灭火器" });
    await cancelTask(t.id);
    expect((await listTasks({ status: "all" })).find((x) => x.id === t.id)?.status).toBe("cancelled");

    await deleteTask(t.id);
    const all = await listTasks({ status: "all" });
    expect(all.find((x) => x.id === t.id)).toBeUndefined();
    // 软删除保留在库中
    expect(await db.tasks.get(t.id)).toBeDefined();
  });
});

describe("子任务进度", () => {
  it("父任务子任务进度正确计算", async () => {
    const parent = await createTask({ title: "家庭安全大检查" });
    const s1 = await createTask({ title: "装烟雾报警器", parentId: parent.id });
    const s2 = await createTask({ title: "换燃气软管", parentId: parent.id });
    const s3 = await createTask({ title: "买灭火器", parentId: parent.id });

    let p = await getSubtaskProgress(parent.id);
    expect(p).toEqual({ total: 3, done: 0, ratio: 0 });

    await completeTask(s1.id);
    p = await getSubtaskProgress(parent.id);
    expect(p.done).toBe(1);
    expect(p.ratio).toBeCloseTo(1 / 3);

    await completeTask(s2.id);
    await completeTask(s3.id);
    p = await getSubtaskProgress(parent.id);
    expect(p.ratio).toBe(1);

    const subs = await getSubtasks(parent.id);
    expect(subs.length).toBe(3);
  });
});

describe("筛选与逾期", () => {
  it("今日统计：待办、已完成、逾期", async () => {
    const today = todayKey();
    await createTask({ title: "今日事", plannedDate: today });
    const doneTask = await createTask({ title: "今日毕", plannedDate: today });
    await completeTask(doneTask.id);
    await createTask({ title: "过期事", dueDate: addDays(today, -3), plannedDate: addDays(today, -3) });

    const stats = await getTodayStats();
    expect(stats.todo.length).toBe(1);
    expect(stats.done.length).toBe(1);
    expect(stats.overdue.length).toBe(1);
  });

  it("过程记录（note）写入并按时间倒序", async () => {
    const t = await createTask({ title: "装修比价" });
    await addTaskNote(t.id, "问了第一家，报价 8 万");
    // 确保两条记录时间戳可区分（人打字天然有间隔，此处显式等待）
    await new Promise((r) => setTimeout(r, 5));
    await addTaskNote(t.id, "第二家 6.5 万");
    const logs = await getTaskLogs(t.id);
    expect(logs.filter((l) => l.type === "note").length).toBe(2);
    expect(logs[0].text).toBe("第二家 6.5 万");
  });
});
