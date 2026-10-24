import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  recurringCatalog,
  itemsByFrequency,
  FREQ_LABELS,
  NODE_LABELS,
  type CatalogFrequency,
  type CatalogItem,
} from "@/domain/recurringCatalog";
import {
  setSelectedRecurring,
  setOnboardingCompleted,
  ensureRecurringTasksForToday,
} from "@/domain/autoTask";
import { PageHeader, Button, Badge } from "@/components/ui";
import { todayKey } from "@/lib/date";

const FREQ_ORDER: CatalogFrequency[] = ["daily", "weekly", "monthly", "yearly"];
const FREQ_DESC: Record<CatalogFrequency, string> = {
  daily: "每日生成待办，当天完成。坚持最久，复利最大。",
  weekly: "每周一生成，本周内完成即可。",
  monthly: "每月1号生成。",
  yearly: "每年生成一次，多为体检、筛查、年审类。",
};

export default function Onboarding({ rerun = false }: { rerun?: boolean }) {
  const nav = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // 初始化：默认勾选全部 high 优先级
  useEffect(() => {
    const defaults = new Set<string>();
    for (const item of recurringCatalog.items) {
      if (item.priority === "high") defaults.add(item.entryId);
    }
    setSelected(defaults);
  }, []);

  const grouped = useMemo(() => {
    const m = new Map<CatalogFrequency, CatalogItem[]>();
    for (const f of FREQ_ORDER) m.set(f, itemsByFrequency(f));
    return m;
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll(freq: CatalogFrequency) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of grouped.get(freq) ?? []) next.add(item.entryId);
      return next;
    });
  }

  function clearFreq(freq: CatalogFrequency) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of grouped.get(freq) ?? []) next.delete(item.entryId);
      return next;
    });
  }

  async function finish() {
    setSubmitting(true);
    const ids = Array.from(selected);
    await setSelectedRecurring(ids);
    await setOnboardingCompleted(true);
    await ensureRecurringTasksForToday();
    setSubmitting(false);
    nav("/", { replace: true });
  }

  const totalCount = recurringCatalog.total;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeader
        title={rerun ? "重选内政纲领" : "立国之初"}
        subtitle={
          rerun
            ? "调整你要坚持的周期事项。保存后立即生效，新的待办会在下个周期生成。"
            : "从《高性价比人生指南》767 条里，精选 36 项可日常执行的周期事项。勾选你要坚持的，系统自动生成每日 / 每周 / 每年待办。"
        }
      />

      {/* 进度概览 */}
      <div className="mb-6 rounded-xl border border-line bg-paper/60 px-4 py-3 text-sm text-ink-soft">
        已选 <span className="font-semibold text-teal-deep">{selected.size}</span> 项 · 共 {totalCount} 项可选 · 默认勾选全部高优先级（证据 A + 收益大）
      </div>

      {/* 分组 */}
      <div className="space-y-8">
        {FREQ_ORDER.map((freq) => {
          const items = grouped.get(freq) ?? [];
          if (items.length === 0) return null;
          const selectedInFreq = items.filter((i) => selected.has(i.entryId)).length;
          return (
            <section key={freq}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-serif text-xl text-ink">
                    {FREQ_LABELS[freq]} · <span className="text-ink-faint">{items.length} 项</span>
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-faint">{FREQ_DESC[freq]}</p>
                </div>
                <div className="flex gap-1.5 text-xs">
                  <button onClick={() => selectAll(freq)} className="rounded-md border border-line px-2 py-1 text-ink-soft hover:border-teal hover:text-teal-deep">
                    全选
                  </button>
                  <button onClick={() => clearFreq(freq)} className="rounded-md border border-line px-2 py-1 text-ink-soft hover:border-vermilion hover:text-vermilion">
                    清空
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {items.map((item) => {
                  const checked = selected.has(item.entryId);
                  return (
                    <label
                      key={item.entryId}
                      className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-3.5 py-3 transition-colors ${
                        checked ? "border-teal/50 bg-teal-soft/30" : "border-line hover:border-ink-faint"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(item.entryId)}
                        className="mt-1 h-4 w-4 shrink-0 accent-teal"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium text-ink">{item.actionLabel}</span>
                          <Badge tone={item.evidenceGrade === "A" ? "vermilion" : item.evidenceGrade === "B" ? "gold" : "gray"}>
                            证据 {item.evidenceGrade}
                          </Badge>
                          {item.node !== "anytime" && item.node !== "year-anytime" && (
                            <Badge tone="jade">{NODE_LABELS[item.node] ?? item.node}</Badge>
                          )}
                          <Badge tone="gray">{item.scope}</Badge>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-faint">{item.plainTalk}</p>
                      </div>
                      {checked && <span className="mt-0.5 shrink-0 text-teal">✓</span>}
                    </label>
                  );
                })}
              </div>
              {items.length > 0 && (
                <p className="mt-2 text-right text-xs text-ink-faint">已选 {selectedInFreq} / {items.length}</p>
              )}
            </section>
          );
        })}
      </div>

      {/* 底部固定栏 */}
      <div className="sticky bottom-0 z-10 mt-8 -mx-4 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <span className="text-sm text-ink-soft">
            已确立 <span className="font-semibold text-teal-deep">{selected.size}</span> 项纲领
          </span>
          <Button variant="primary" onClick={() => void finish()} disabled={submitting || selected.size === 0}>
            {submitting ? "正在生成待办…" : "确立纲领，开始内政"}
          </Button>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-ink-faint">
        今日 {todayKey()} · 确立后系统立即生成当前周期待办，可在内务府随时重选。
      </p>
    </div>
  );
}
