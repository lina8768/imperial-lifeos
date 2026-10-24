import { db, type Metric, type MetricRecord, type MetricDataType, type MetricFrequency } from "@/storage/db";
import { uuid, nowISO } from "@/lib/date";

export interface MetricInput {
  name: string;
  unit: string;
  dataType: MetricDataType;
  frequency: MetricFrequency;
  targetValue?: number | null;
}

export async function listMetrics(): Promise<Metric[]> {
  const rows = await db.metrics.toArray();
  return rows
    .filter((m) => !m.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function createMetric(input: MetricInput): Promise<Metric> {
  if (!input.name.trim()) throw new Error("指标名称不能为空");
  if (!input.unit.trim()) throw new Error("单位不能为空");
  const now = nowISO();
  const metric: Metric = {
    id: uuid(),
    name: input.name.trim(),
    unit: input.unit.trim(),
    dataType: input.dataType,
    frequency: input.frequency,
    targetValue: input.targetValue ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await db.metrics.add(metric);
  return metric;
}

export async function updateMetric(id: string, patch: Partial<MetricInput>): Promise<Metric> {
  const metric = await db.metrics.get(id);
  if (!metric) throw new Error(`指标不存在：${id}`);
  const next: Metric = { ...metric, ...patch, updatedAt: nowISO() };
  if (patch.name !== undefined && !patch.name.trim()) throw new Error("指标名称不能为空");
  await db.metrics.put(next);
  return next;
}

export async function deleteMetric(id: string): Promise<void> {
  const now = nowISO();
  await db.transaction("rw", [db.metrics, db.metricRecords], async () => {
    await db.metrics.update(id, { deletedAt: now, updatedAt: now });
    const recs = await db.metricRecords.where("metricId").equals(id).toArray();
    await db.metricRecords.bulkDelete(recs.map((r) => r.id));
  });
}

export async function addRecord(
  metricId: string,
  date: string,
  value: number,
  note?: string | null
): Promise<MetricRecord> {
  const metric = await db.metrics.get(metricId);
  if (!metric) throw new Error(`指标不存在：${metricId}`);
  if (Number.isNaN(value)) throw new Error("数值无效");
  if (metric.dataType === "boolean" && value !== 0 && value !== 1) {
    throw new Error("布尔型指标只能记录 0 或 1");
  }
  const existing = await db.metricRecords.where("[metricId+date]").equals([metricId, date]).first();
  const now = nowISO();
  if (existing) {
    const next: MetricRecord = {
      ...existing,
      value,
      note: note ?? existing.note,
      updatedAt: now,
    };
    await db.metricRecords.put(next);
    return next;
  }
  const record: MetricRecord = {
    id: uuid(),
    metricId,
    date,
    value,
    note: note ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await db.metricRecords.add(record);
  return record;
}

export async function updateRecord(
  id: string,
  patch: { date?: string; value?: number; note?: string | null }
): Promise<MetricRecord> {
  const rec = await db.metricRecords.get(id);
  if (!rec) throw new Error(`记录不存在：${id}`);
  const next: MetricRecord = { ...rec, ...patch, updatedAt: nowISO() };
  await db.metricRecords.put(next);
  return next;
}

export async function deleteRecord(id: string): Promise<void> {
  await db.metricRecords.delete(id);
}

export async function listRecords(
  metricId: string,
  range?: { start: string; end: string }
): Promise<MetricRecord[]> {
  let rows: MetricRecord[];
  if (range) {
    rows = await db.metricRecords
      .where("date")
      .between(range.start, range.end, true, true)
      .and((r) => r.metricId === metricId)
      .toArray();
  } else {
    rows = await db.metricRecords.where("metricId").equals(metricId).toArray();
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

export interface MetricSummary {
  latest: MetricRecord | null;
  previous: MetricRecord | null;
  delta: number | null;
  count: number;
}

export async function getMetricSummary(metricId: string): Promise<MetricSummary> {
  const rows = await listRecords(metricId);
  const latest = rows.length ? rows[rows.length - 1] : null;
  const previous = rows.length > 1 ? rows[rows.length - 2] : null;
  return {
    latest,
    previous,
    delta: latest && previous ? latest.value - previous.value : null,
    count: rows.length,
  };
}

/** 最近有记录的指标（御前总览用） */
export async function getRecentMetrics(limit = 3): Promise<{ metric: Metric; summary: MetricSummary }[]> {
  const metrics = await listMetrics();
  const result: { metric: Metric; summary: MetricSummary }[] = [];
  for (const m of metrics) {
    const summary = await getMetricSummary(m.id);
    if (summary.latest) result.push({ metric: m, summary });
  }
  return result
    .sort((a, b) => (b.summary.latest?.date ?? "").localeCompare(a.summary.latest?.date ?? ""))
    .slice(0, limit);
}
