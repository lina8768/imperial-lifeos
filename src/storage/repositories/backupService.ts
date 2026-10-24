import { z } from "zod";
import { db, SCHEMA_VERSION, type Task, type TaskLog, type Metric, type MetricRecord, type DailyJournal, type Review, type ReviewAction, type EntryFavorite, type AppSetting } from "@/storage/db";
import { getBookVersion } from "@/storage/bookSeed";
import { nowISO } from "@/lib/date";

/* ============ 备份结构（Zod Schema） ============ */

const isoString = z.string().min(1);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 YYYY-MM-DD");

const TaskStatusZ = z.enum(["todo", "doing", "done", "cancelled"]);
const TaskPriorityZ = z.enum(["low", "medium", "high", "urgent"]);
const RecurrenceZ = z.enum(["none", "daily", "weekly", "monthly"]);
const MetricDataTypeZ = z.enum(["number", "count", "duration", "money", "boolean"]);
const MetricFrequencyZ = z.enum(["daily", "weekly", "monthly", "irregular"]);
const ReviewPeriodZ = z.enum(["daily", "weekly", "monthly", "yearly"]);

const TaskZ = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  status: TaskStatusZ,
  priority: TaskPriorityZ,
  plannedDate: dateKey.nullable(),
  dueDate: dateKey.nullable(),
  completedAt: isoString.nullable(),
  parentId: z.string().nullable(),
  entryId: z.string().nullable(),
  recurrence: RecurrenceZ,
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
});

const TaskLogZ = z.object({
  id: z.string().min(1),
  taskId: z.string().min(1),
  type: z.enum(["status", "note"]),
  fromStatus: TaskStatusZ.nullable(),
  toStatus: TaskStatusZ.nullable(),
  text: z.string().nullable(),
  createdAt: isoString,
});

const MetricZ = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  unit: z.string().min(1),
  dataType: MetricDataTypeZ,
  frequency: MetricFrequencyZ,
  targetValue: z.number().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
});

const MetricRecordZ = z.object({
  id: z.string().min(1),
  metricId: z.string().min(1),
  date: dateKey,
  value: z.number(),
  note: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
});

const JournalZ = z.object({
  id: dateKey,
  date: dateKey,
  content: z.string(),
  createdAt: isoString,
  updatedAt: isoString,
});

const ReviewZ = z.object({
  id: z.string().min(1),
  periodType: ReviewPeriodZ,
  startDate: dateKey,
  endDate: dateKey,
  content: z.string(),
  createdAt: isoString,
  updatedAt: isoString,
});

const ReviewActionZ = z.object({
  id: z.string().min(1),
  reviewId: z.string().min(1),
  taskId: z.string().min(1),
  createdAt: isoString,
});

const FavoriteZ = z.object({
  entryId: z.string().min(1),
  note: z.string().nullable(),
  createdAt: isoString,
});

const SettingZ = z.object({
  key: z.string().min(1),
  value: z.unknown(),
});

export const BackupSchema = z.object({
  app: z.literal("imperial-lifeos"),
  schemaVersion: z.number().int().positive(),
  exportedAt: isoString,
  bookVersion: z
    .object({ commitSha: z.string(), contentHash: z.string() })
    .nullable()
    .optional(),
  data: z.object({
    tasks: z.array(TaskZ),
    taskLogs: z.array(TaskLogZ),
    metrics: z.array(MetricZ),
    metricRecords: z.array(MetricRecordZ),
    journals: z.array(JournalZ),
    reviews: z.array(ReviewZ),
    reviewActions: z.array(ReviewActionZ),
    entryFavorites: z.array(FavoriteZ),
    appSettings: z.array(SettingZ),
  }),
});

export type Backup = z.infer<typeof BackupSchema>;

/* ============ 导出 ============ */

export interface ExportData {
  tasks: Task[];
  taskLogs: TaskLog[];
  metrics: Metric[];
  metricRecords: MetricRecord[];
  journals: DailyJournal[];
  reviews: Review[];
  reviewActions: ReviewAction[];
  entryFavorites: EntryFavorite[];
  appSettings: AppSetting[];
}

export async function exportAll(): Promise<Backup> {
  const bookVersion = await getBookVersion();
  const [tasks, taskLogs, metrics, metricRecords, journals, reviews, reviewActions, entryFavorites, appSettings] =
    await Promise.all([
      db.tasks.toArray(),
      db.taskLogs.toArray(),
      db.metrics.toArray(),
      db.metricRecords.toArray(),
      db.dailyJournals.toArray(),
      db.reviews.toArray(),
      db.reviewActions.toArray(),
      db.entryFavorites.toArray(),
      db.appSettings.toArray(),
    ]);
  return {
    app: "imperial-lifeos",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowISO(),
    bookVersion: bookVersion
      ? { commitSha: bookVersion.commitSha, contentHash: bookVersion.contentHash }
      : null,
    data: {
      tasks,
      taskLogs,
      metrics,
      metricRecords,
      journals,
      reviews,
      reviewActions,
      entryFavorites,
      appSettings,
    },
  };
}

export function backupToJSON(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

export function downloadBackup(backup: Backup): void {
  const blob = new Blob([backupToJSON(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `imperial-lifeos-backup-${new Date().toISOString().slice(0, 10)}.lifeos.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ============ 导入 ============ */

export interface ImportPreview {
  backup: Backup;
  counts: Record<string, number>;
  currentCounts: Record<string, number>;
  bookMismatch: boolean;
}

/** 解析并校验备份文件，返回预览信息；失败抛错 */
export async function parseBackup(jsonText: string): Promise<ImportPreview> {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    throw new Error("文件不是有效的 JSON");
  }
  const parsed = BackupSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new Error(`备份结构校验失败：${first.path.join(".")} ${first.message}`);
  }
  const backup = parsed.data;
  if (backup.schemaVersion > SCHEMA_VERSION) {
    throw new Error(`备份结构版本（v${backup.schemaVersion}）高于当前应用（v${SCHEMA_VERSION}），请先升级应用`);
  }
  const counts: Record<string, number> = {
    tasks: backup.data.tasks.length,
    taskLogs: backup.data.taskLogs.length,
    metrics: backup.data.metrics.length,
    metricRecords: backup.data.metricRecords.length,
    journals: backup.data.journals.length,
    reviews: backup.data.reviews.length,
    reviewActions: backup.data.reviewActions.length,
    entryFavorites: backup.data.entryFavorites.length,
    appSettings: backup.data.appSettings.length,
  };
  const currentCounts: Record<string, number> = {
    tasks: await db.tasks.count(),
    taskLogs: await db.taskLogs.count(),
    metrics: await db.metrics.count(),
    metricRecords: await db.metricRecords.count(),
    journals: await db.dailyJournals.count(),
    reviews: await db.reviews.count(),
    reviewActions: await db.reviewActions.count(),
    entryFavorites: await db.entryFavorites.count(),
    appSettings: await db.appSettings.count(),
  };
  const bookVersion = await getBookVersion();
  const bookMismatch =
    !!backup.bookVersion &&
    !!bookVersion &&
    backup.bookVersion.contentHash !== bookVersion.contentHash;
  return { backup, counts, currentCounts, bookMismatch };
}

/** 整体替换式恢复（用户明确确认后调用） */
export async function restoreBackup(backup: Backup): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.tasks, db.taskLogs, db.metrics, db.metricRecords,
      db.dailyJournals, db.reviews, db.reviewActions,
      db.entryFavorites, db.appSettings,
    ],
    async () => {
      await db.tasks.clear();
      await db.tasks.bulkPut(backup.data.tasks);
      await db.taskLogs.clear();
      await db.taskLogs.bulkPut(backup.data.taskLogs);
      await db.metrics.clear();
      await db.metrics.bulkPut(backup.data.metrics);
      await db.metricRecords.clear();
      await db.metricRecords.bulkPut(backup.data.metricRecords);
      await db.dailyJournals.clear();
      await db.dailyJournals.bulkPut(backup.data.journals);
      await db.reviews.clear();
      await db.reviews.bulkPut(backup.data.reviews);
      await db.reviewActions.clear();
      await db.reviewActions.bulkPut(backup.data.reviewActions);
      await db.entryFavorites.clear();
      await db.entryFavorites.bulkPut(backup.data.entryFavorites);
      await db.appSettings.clear();
      await db.appSettings.bulkPut(backup.data.appSettings as AppSetting[]);
    }
  );
}
