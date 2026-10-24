import Dexie, { type Table } from "dexie";

/* ============ 类型定义 ============ */

export type TaskStatus = "todo" | "doing" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type Recurrence = "none" | "daily" | "weekly" | "monthly";
export type MetricDataType = "number" | "count" | "duration" | "money" | "boolean";
export type MetricFrequency = "daily" | "weekly" | "monthly" | "irregular";
export type ReviewPeriod = "daily" | "weekly" | "monthly" | "yearly";
export type EvidenceGrade = "A" | "B" | "C";

export interface BookVersion {
  id: string; // commit SHA
  repoUrl: string;
  commitSha: string;
  syncedAt: string;
  contentHash: string;
  chapterCount: number;
  entryCount: number;
  stats: {
    grades: Record<string, number>;
    scopes: Record<string, number>;
    controversialCount: number;
    crossrefCount: number;
    sourceLinkCount: number;
  };
}

export interface BookChapter {
  id: string;
  number: number;
  title: string;
  fileName: string;
  order: number;
  intro: string;
  entryCount: number;
  contentHash: string;
}

export interface EntryTags {
  money: number | null;
  time: number | null;
  willpower: number | null;
  benefit: number | null;
  scope: string | null;
  audience: string | null;
}

export interface BookEntry {
  id: string;
  chapterId: string;
  chapterNumber: number;
  entryNumber: number;
  globalIndex: number;
  title: string;
  cost: string;
  plainTalk: string;
  benefit: string;
  evidenceGrade: EvidenceGrade;
  controversial: boolean;
  gradeNote: string | null;
  tags: EntryTags;
  note: string;
  sources: { index: number; text: string; url: string | null }[];
  crossrefs: { chapterNumber: number; entryNumber: number; raw: string; targetEntryId: string }[];
  contentHash: string;
  /** 检索用拼接文本（应用侧生成） */
  searchText?: string;
}

export interface EntryReference {
  id: string;
  entryId: string;
  kind: "source" | "crossref";
  text: string;
  url: string | null;
  targetEntryId: string | null;
}

export interface EntryFavorite {
  entryId: string;
  note: string | null;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  plannedDate: string | null; // YYYY-MM-DD
  dueDate: string | null;
  completedAt: string | null;
  parentId: string | null;
  entryId: string | null; // 关联原书条目
  recurrence: Recurrence;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface TaskLog {
  id: string;
  taskId: string;
  type: "status" | "note";
  fromStatus: TaskStatus | null;
  toStatus: TaskStatus | null;
  text: string | null;
  createdAt: string;
}

export interface Metric {
  id: string;
  name: string;
  unit: string;
  dataType: MetricDataType;
  frequency: MetricFrequency;
  targetValue: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface MetricRecord {
  id: string;
  metricId: string;
  date: string; // YYYY-MM-DD
  value: number; // boolean 存 0/1
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailyJournal {
  id: string; // YYYY-MM-DD
  date: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  periodType: ReviewPeriod;
  startDate: string;
  endDate: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewAction {
  id: string;
  reviewId: string;
  taskId: string;
  createdAt: string;
}

export interface AppSetting {
  key: string;
  value: unknown;
}

export interface SchemaMigration {
  version: number;
  appliedAt: string;
}

/* ============ 数据库 ============ */

export class ImperialLifeOSDB extends Dexie {
  bookVersions!: Table<BookVersion, string>;
  bookChapters!: Table<BookChapter, string>;
  bookEntries!: Table<BookEntry, string>;
  entryReferences!: Table<EntryReference, string>;
  entryFavorites!: Table<EntryFavorite, string>;
  tasks!: Table<Task, string>;
  taskLogs!: Table<TaskLog, string>;
  metrics!: Table<Metric, string>;
  metricRecords!: Table<MetricRecord, string>;
  dailyJournals!: Table<DailyJournal, string>;
  reviews!: Table<Review, string>;
  reviewActions!: Table<ReviewAction, string>;
  appSettings!: Table<AppSetting, string>;
  schemaMigrations!: Table<SchemaMigration, number>;

  constructor() {
    super("imperial-lifeos");
    this.version(1).stores({
      bookVersions: "id",
      bookChapters: "id, number",
      bookEntries: "id, chapterId, chapterNumber, evidenceGrade, globalIndex",
      entryReferences: "id, entryId, [kind+entryId]",
      entryFavorites: "entryId, createdAt",
      tasks: "id, parentId, status, plannedDate, dueDate, entryId, updatedAt",
      taskLogs: "id, taskId, createdAt",
      metrics: "id, name",
      metricRecords: "id, metricId, date, [metricId+date]",
      dailyJournals: "id, date",
      reviews: "id, periodType, startDate",
      reviewActions: "id, reviewId, taskId",
      appSettings: "key",
      schemaMigrations: "version",
    });
  }
}

export const db = new ImperialLifeOSDB();

export const SCHEMA_VERSION = 1;
