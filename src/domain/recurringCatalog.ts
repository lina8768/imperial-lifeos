/**
 * 周期性条目 catalog —— 从《高性价比人生指南》767 条里提取的
 * 可日常执行的周期性条目，按频率/节点/优先级标注。
 *
 * 数据由 scripts/extract-recurring.mjs 离线生成，此处仅做类型化导入。
 */
import catalogJson from "@/data/recurring-catalog.json";

export type CatalogFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type CatalogPriority = "high" | "medium" | "low";

export interface CatalogItem {
  entryId: string;
  chapterNumber: number;
  entryNumber: number;
  title: string;
  plainTalk: string;
  frequency: CatalogFrequency;
  node: string;
  priority: CatalogPriority;
  priorityScore: number;
  evidenceGrade: "A" | "B" | "C";
  scope: string;
  costTags: { money: number; time: number; willpower: number; benefit: number };
  actionLabel: string;
}

export interface RecurringCatalog {
  sourceCommit: string;
  sourceRepo: string;
  sourceSyncedAt: string;
  extractedAt: string;
  total: number;
  byFrequency: Record<CatalogFrequency, number>;
  byPriority: Record<CatalogPriority, number>;
  items: CatalogItem[];
}

export const recurringCatalog = catalogJson as unknown as RecurringCatalog;

/** 按频率分组，组内按优先级得分降序 */
export function itemsByFrequency(freq: CatalogFrequency): CatalogItem[] {
  return recurringCatalog.items
    .filter((i) => i.frequency === freq)
    .sort((a, b) => b.priorityScore - a.priorityScore);
}

export function findCatalogItem(entryId: string): CatalogItem | undefined {
  return recurringCatalog.items.find((i) => i.entryId === entryId);
}

/** 节点中文标签 */
export const NODE_LABELS: Record<string, string> = {
  morning: "晨起",
  evening: "睡前",
  "before-meal": "餐前",
  "after-meal": "餐后",
  anytime: "随时",
  weekend: "周末",
  "month-start": "月初",
  "month-end": "月底",
  "year-start": "年初",
  "year-end": "年底",
  "year-q1": "一季度",
  "year-q2": "二季度",
  "year-q3": "三季度",
  "year-q4": "四季度",
  "year-h1": "上半年",
  "year-anytime": "年内任意",
};

/** 频率中文标签 */
export const FREQ_LABELS: Record<CatalogFrequency, string> = {
  daily: "每日",
  weekly: "每周",
  monthly: "每月",
  yearly: "每年",
};
