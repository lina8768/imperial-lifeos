import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PageHeader, Button, Input, Select, EmptyState, Badge, Textarea } from "@/components/ui";
import { Dialog, ConfirmDialog } from "@/components/Dialog";
import {
  listMetrics, createMetric, updateMetric, deleteMetric,
  listRecords, addRecord, updateRecord, deleteRecord, getMetricSummary,
} from "@/storage/repositories/metricRepo";
import type { Metric, MetricRecord, MetricDataType, MetricFrequency } from "@/storage/db";
import { todayKey, formatShort } from "@/lib/date";

const DATA_TYPE_LABELS: Record<MetricDataType, string> = {
  number: "数值",
  count: "次数",
  duration: "时长",
  money: "金额",
  boolean: "布尔",
};

const FREQ_LABELS: Record<MetricFrequency, string> = {
  daily: "每日",
  weekly: "每周",
  monthly: "每月",
  irregular: "不定期",
};

type RangeKey = "7d" | "30d" | "90d" | "all";

/** 常用指标模板：来自典籍中证据 A 级、日常可量化的条目 */
const METRIC_TEMPLATES = [
  { name: "体重", unit: "kg", dataType: "number" as MetricDataType, frequency: "weekly" as MetricFrequency },
  { name: "睡眠时长", unit: "小时", dataType: "duration" as MetricDataType, frequency: "daily" as MetricFrequency },
  { name: "运动", unit: "次", dataType: "count" as MetricDataType, frequency: "daily" as MetricFrequency },
  { name: "血压高压", unit: "mmHg", dataType: "number" as MetricDataType, frequency: "weekly" as MetricFrequency },
  { name: "月开销", unit: "元", dataType: "money" as MetricDataType, frequency: "monthly" as MetricFrequency },
  { name: "今日锻炼", unit: "是/否", dataType: "boolean" as MetricDataType, frequency: "daily" as MetricFrequency },
];

export default function MetricsPage() {
  const [params] = useSearchParams();
  const [metrics, setMetrics] = useState<Metric[] | null>(null);
  const [selected, setSelected] = useState<Metric | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    const list = await listMetrics();
    setMetrics(list);
    return list;
  }

  useEffect(() => {
    void (async () => {
      const list = await refresh();
      const focus = params.get("focus");
      if (focus) {
        const m = list.find((x) => x.id === focus);
        if (m) setSelected(m);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onDeleteMetric(m: Metric) {
    await deleteMetric(m.id);
    setSelected(null);
    await refresh();
  }

  async function onAddTemplate(tpl: (typeof METRIC_TEMPLATES)[number]) {
    await createMetric({ name: tpl.name, unit: tpl.unit, dataType: tpl.dataType, frequency: tpl.frequency });
    await refresh();
  }

  return (
    <div>
      <PageHeader
        title="国库与国情"
        subtitle="自设指标，量入为出"
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={14} /> 开列指标
          </Button>
        }
      />

      {!metrics ? (
        <p className="p-4 text-sm text-ink-faint">加载中……</p>
      ) : metrics.length === 0 ? (
        <EmptyState
          title="国库尚空"
          hint="创建体重、睡眠时长、月开销等指标，持续记录后可看趋势。"
          action={
            <div className="flex flex-col items-center gap-3">
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus size={14} /> 开列指标
              </Button>
              <div>
                <p className="mb-2 text-[11px] text-ink-faint">或一键开列常用健康指标（来自典籍高性价比条目）：</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {METRIC_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.name}
                      onClick={() => void onAddTemplate(tpl)}
                      className="rounded-full border border-teal/30 bg-teal-soft/50 px-3 py-1 text-xs text-teal-deep transition-colors hover:bg-teal-soft"
                    >
                      + {tpl.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          }
        />
      ) : selected ? (
        <MetricDetail
          metric={selected}
          onBack={async () => {
            setSelected(null);
            await refresh();
          }}
          onDelete={() => onDeleteMetric(selected)}
          onRename={async (patch) => {
            await updateMetric(selected.id, patch);
            await refresh();
            setSelected({ ...selected, ...patch });
          }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((m) => (
            <MetricCard key={m.id} metric={m} onOpen={() => setSelected(m)} />
          ))}
        </ul>
      )}

      {creating && <MetricDialog onClose={() => setCreating(false)} onSaved={refresh} />}
    </div>
  );
}

function MetricCard({ metric, onOpen }: { metric: Metric; onOpen: () => void }) {
  const [summary, setSummary] = useState<{ latest: MetricRecord | null; delta: number | null; count: number } | null>(null);
  useEffect(() => {
    void getMetricSummary(metric.id).then(setSummary);
  }, [metric.id]);

  const hitTarget =
    summary?.latest != null && metric.targetValue != null && summary.latest.value >= metric.targetValue;

  return (
    <li>
      <button onClick={onOpen} className="panel block w-full p-4 text-left transition-colors hover:border-vermilion/40">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-sm font-semibold">{metric.name}</h3>
          {metric.targetValue != null && (
            <Badge tone={hitTarget ? "jade" : "neutral"}>目标 {metric.targetValue}</Badge>
          )}
        </div>
        <p className="mt-2 flex items-baseline gap-1.5">
          <span className="font-serif text-2xl font-semibold">
            {summary?.latest ? formatValue(summary.latest.value, metric.dataType) : "—"}
          </span>
          <span className="text-xs text-ink-faint">{metric.unit}</span>
          {summary?.delta != null && summary.delta !== 0 && (
            <span className={`text-xs ${summary.delta > 0 ? "text-vermilion" : "text-jade"}`}>
              {summary.delta > 0 ? "▲" : "▼"}
              {formatValue(Math.abs(summary.delta), metric.dataType)}
            </span>
          )}
        </p>
        <p className="mt-1.5 text-[11px] text-ink-faint">
          {FREQ_LABELS[metric.frequency]} · {DATA_TYPE_LABELS[metric.dataType]} · {summary?.count ?? 0} 条记录
          {summary?.latest ? ` · 最近 ${formatShort(summary.latest.date)}` : ""}
        </p>
      </button>
    </li>
  );
}

function formatValue(v: number, dataType: MetricDataType): string {
  if (dataType === "boolean") return v === 1 ? "是" : "否";
  if (dataType === "money") return `¥${v}`;
  return String(v);
}

/* ============ 指标详情（图表 + 记录表） ============ */

function MetricDetail({
  metric, onBack, onDelete, onRename,
}: {
  metric: Metric;
  onBack: () => void;
  onDelete: () => void;
  onRename: (patch: { name?: string; unit?: string; targetValue?: number | null }) => Promise<void>;
}) {
  const [range, setRange] = useState<RangeKey>("30d");
  const [records, setRecords] = useState<MetricRecord[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MetricRecord | null>(null);
  const [chartData, setChartData] = useState<{ date: string; value: number }[]>([]);

  const rangeStart = useMemo(() => {
    if (range === "all") return "0000-01-01";
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [range]);

  async function refresh() {
    setRecords(await listRecords(metric.id, { start: rangeStart, end: "9999-12-31" }));
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric.id, rangeStart]);

  useEffect(() => {
    if (records) setChartData(records.map((r) => ({ date: r.date.slice(5), value: r.value })));
  }, [records]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button onClick={onBack} className="text-xs text-ink-faint hover:text-vermilion">
          ← 返回指标列表
        </button>
        <div className="flex items-center gap-2">
          <Select value={range} onChange={(e) => setRange(e.target.value as RangeKey)} className="w-28 py-1 text-xs" aria-label="时间范围">
            <option value="7d">近 7 天</option>
            <option value="30d">近 30 天</option>
            <option value="90d">近 90 天</option>
            <option value="all">全部</option>
          </Select>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus size={12} /> 记一笔
          </Button>
          <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={12} /> 删除指标
          </Button>
        </div>
      </div>

      <div className="panel mb-4 p-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-serif text-lg font-semibold">
              {metric.name}
              <span className="ml-2 text-xs font-normal text-ink-faint">
                单位 {metric.unit} · {FREQ_LABELS[metric.frequency]}
                {metric.targetValue != null ? ` · 目标 ${metric.targetValue}` : ""}
              </span>
            </h2>
          </div>
          <Button size="sm" variant="ghost" onClick={() => {
            const name = prompt("新名称", metric.name);
            if (name && name.trim()) void onRename({ name });
          }}>
            <Pencil size={12} /> 改名
          </Button>
        </div>

        {/* 图表（懒加载 Recharts） */}
        {chartData.length > 1 ? (
          <MetricChart data={chartData} dataType={metric.dataType} />
        ) : chartData.length === 1 ? (
          <p className="py-8 text-center text-xs text-ink-faint">只有 1 条记录，再来一笔即可看趋势。</p>
        ) : (
          <p className="py-8 text-center text-xs text-ink-faint">该时间范围内暂无记录。</p>
        )}
      </div>

      {/* 记录表 */}
      {!records ? (
        <p className="text-sm text-ink-faint">加载中……</p>
      ) : records.length === 0 ? (
        <EmptyState title="暂无记录" hint="点击「记一笔」开始记录。" />
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-faint">
                <th className="px-4 py-2.5 font-normal">日期</th>
                <th className="px-4 py-2.5 font-normal">数值</th>
                <th className="px-4 py-2.5 font-normal">备注</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {[...records].reverse().map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2">{r.date}</td>
                  <td className="px-4 py-2 font-serif font-semibold">{formatValue(r.value, metric.dataType)}</td>
                  <td className="max-w-48 truncate px-4 py-2 text-xs text-ink-soft">{r.note ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button aria-label="编辑记录" onClick={() => setEditingRecord(r)} className="rounded p-1 text-ink-faint hover:text-ink">
                      <Pencil size={13} />
                    </button>
                    <button
                      aria-label="删除记录"
                      onClick={async () => {
                        await deleteRecord(r.id);
                        await refresh();
                      }}
                      className="rounded p-1 text-ink-faint hover:text-danger"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <RecordDialog
          metric={metric}
          onClose={() => setAdding(false)}
          onSaved={refresh}
        />
      )}
      {editingRecord && (
        <RecordDialog
          metric={metric}
          existing={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSaved={refresh}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(false)}
        title="删除此指标？"
        description={`「${metric.name}」及其全部 ${records?.length ?? 0} 条记录将被删除。`}
        confirmLabel="确认删除"
        danger
        onConfirm={onDelete}
      >
        <p className="rounded bg-danger/5 p-3 text-xs text-danger">⚠️ 删除后不可恢复，请先导出备份。</p>
      </ConfirmDialog>
    </div>
  );
}

function MetricChart({ data, dataType }: { data: { date: string; value: number }[]; dataType: MetricDataType }) {
  return (
    <Suspense fallback={<p className="py-16 text-center text-xs text-ink-faint">图表加载中……</p>}>
      <LazyChart data={data} dataType={dataType} />
    </Suspense>
  );
}

/** Recharts 懒加载图表（manualChunks 已按需分包，这里再按 Suspense 拆分首屏） */
const LazyChart = lazy(async () => {
  const recharts = await import("recharts");
  function Chart({ data, dataType }: { data: { date: string; value: number }[]; dataType: MetricDataType }) {
    const { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip } = recharts;
    return (
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#8A857C" }} stroke="#E7E1D6" />
          <YAxis
            tick={{ fontSize: 10, fill: "#8A857C" }}
            stroke="#E7E1D6"
            domain={dataType === "boolean" ? [0, 1] : (["auto", "auto"] as const)}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #E7E1D6" }}
            labelStyle={{ color: "#57534E" }}
          />
          <Line type="monotone" dataKey="value" stroke="#B23A2F" strokeWidth={1.5} dot={{ r: 2, fill: "#B23A2F" }} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  return { default: Chart };
});

/* ============ 记录对话框 ============ */

function RecordDialog({
  metric, existing, onClose, onSaved,
}: {
  metric: Metric;
  existing?: MetricRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(existing?.date ?? todayKey());
  const [value, setValue] = useState(
    existing ? String(existing.value) : metric.dataType === "boolean" ? "1" : ""
  );
  const [note, setNote] = useState(existing?.note ?? "");
  const [error, setError] = useState("");

  async function save() {
    const num = metric.dataType === "boolean" ? (value === "1" ? 1 : 0) : Number(value);
    if (Number.isNaN(num)) {
      setError("请输入有效数值");
      return;
    }
    try {
      if (existing) await updateRecord(existing.id, { date, value: num, note: note || null });
      else await addRecord(metric.id, date, num, note || null);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={existing ? "修改记录" : `记一笔 · ${metric.name}`}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="rec-date">日期</label>
            <Input id="rec-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="rec-value">
              数值{metric.dataType === "boolean" ? "" : `（${metric.unit}）`}
            </label>
            {metric.dataType === "boolean" ? (
              <Select id="rec-value" value={value} onChange={(e) => setValue(e.target.value)}>
                <option value="1">是</option>
                <option value="0">否</option>
              </Select>
            ) : (
              <Input id="rec-value" type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
            )}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="rec-note">备注（可选）</label>
          <Textarea id="rec-note" value={note ?? ""} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={() => void save()}>
            保存
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/* ============ 新建指标对话框 ============ */

function MetricDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("");
  const [dataType, setDataType] = useState<MetricDataType>("number");
  const [frequency, setFrequency] = useState<MetricFrequency>("daily");
  const [target, setTarget] = useState("");
  const [error, setError] = useState("");

  async function save() {
    try {
      await createMetric({
        name,
        unit,
        dataType,
        frequency,
        targetValue: target ? Number(target) : null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="开列指标" description="为想追踪的事定一个度量">
      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="m-name">指标名称</label>
          <Input id="m-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="如：体重、睡眠时长、月开销" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="m-unit">单位</label>
            <Input id="m-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg、小时、元、次" />
          </div>
          <div>
            <label className="label" htmlFor="m-type">数据类型</label>
            <Select id="m-type" value={dataType} onChange={(e) => setDataType(e.target.value as MetricDataType)}>
              {Object.entries(DATA_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="m-freq">记录频率</label>
            <Select id="m-freq" value={frequency} onChange={(e) => setFrequency(e.target.value as MetricFrequency)}>
              {Object.entries(FREQ_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label" htmlFor="m-target">目标值（可选）</label>
            <Input id="m-target" type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={() => void save()} disabled={!name.trim() || !unit.trim()}>
            开列
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
