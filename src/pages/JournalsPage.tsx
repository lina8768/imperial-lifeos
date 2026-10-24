import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, Badge } from "@/components/ui";
import { TaskStatusBadge } from "@/components/taskBadges";
import { getJournal, saveJournal, listJournals } from "@/storage/repositories/journalRepo";
import { listTasks } from "@/storage/repositories/taskRepo";
import { findReview } from "@/storage/repositories/reviewRepo";
import type { Task, DailyJournal, Review } from "@/storage/db";
import { useAutoSave } from "@/components/useAutoSave";
import { todayKey, formatShort, weekdayCN } from "@/lib/date";
import { cn } from "@/lib/utils";

export default function JournalsPage() {
  const today = todayKey();
  const [selected, setSelected] = useState(today);
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [dayTasks, setDayTasks] = useState<Task[]>([]);
  const [dayReview, setDayReview] = useState<Review | null>(null);
  const [history, setHistory] = useState<DailyJournal[]>([]);

  useEffect(() => {
    void (async () => {
      const j = await getJournal(selected);
      setContent(j?.content ?? "");
      setLoaded(true);
      const tasks = await listTasks({ status: "all" });
      setDayTasks(tasks.filter((t) => t.plannedDate === selected || t.dueDate === selected));
      setDayReview((await findReview("daily", { startDate: selected, endDate: selected })) ?? null);
    })();
  }, [selected]);

  useEffect(() => {
    void listJournals().then(setHistory);
  }, [selected]);

  const { state } = useAutoSave(content, async (v) => {
    if (v.trim() || (await getJournal(selected))) {
      await saveJournal(selected, v);
      setHistory(await listJournals());
    }
  }, { enabled: loaded });

  return (
    <div>
      <PageHeader title="起居注" subtitle="日录一言，不必每日落笔" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
        {/* 编辑器 */}
        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selected}
                max={today}
                onChange={(e) => setSelected(e.target.value || today)}
                aria-label="选择日期"
                className="field w-36"
              />
              <span className="text-xs text-ink-faint">
                {formatShort(selected)} · {weekdayCN(selected)}
              </span>
            </div>
            <SaveStateBadge state={state} />
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="今日见闻、想法、得失……自动保存"
            className="field min-h-64 resize-y font-serif leading-8"
            aria-label="日志内容"
          />

          {/* 当日任务与复盘速览 */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <section className="panel p-4">
              <h3 className="mb-2 font-serif text-xs font-semibold text-ink-soft">当日奏折（{dayTasks.length}）</h3>
              {dayTasks.length === 0 ? (
                <p className="text-xs text-ink-faint">当日无任务</p>
              ) : (
                <ul className="space-y-1.5">
                  {dayTasks.map((t) => (
                    <li key={t.id}>
                      <Link to={`/tasks?focus=${t.id}`} className="flex items-center gap-2 hover:text-vermilion">
                        <TaskStatusBadge status={t.status} />
                        <span className={cn("min-w-0 flex-1 truncate text-xs", t.status === "done" && "text-ink-faint line-through")}>
                          {t.title}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel p-4">
              <h3 className="mb-2 font-serif text-xs font-semibold text-ink-soft">当日复盘</h3>
              {dayReview ? (
                <Link to="/reviews" className="block">
                  <p className="line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-ink-soft hover:text-vermilion">
                    {dayReview.content || "（复盘内容为空）"}
                  </p>
                </Link>
              ) : (
                <p className="text-xs text-ink-faint">
                    尚未复盘 ·{" "}
                  <Link to="/reviews" className="text-vermilion hover:underline">
                    去写今日复盘
                  </Link>
                </p>
              )}
            </section>
          </div>
        </div>

        {/* 历史记录 */}
        <aside>
          <h3 className="mb-2 font-serif text-sm font-semibold text-ink-soft">历史起居注</h3>
          {history.length === 0 ? (
            <p className="text-xs text-ink-faint">暂无记录</p>
          ) : (
            <ul className="panel max-h-[32rem] divide-y divide-line overflow-y-auto">
              {history.map((j) => (
                <li key={j.id}>
                  <button
                    onClick={() => setSelected(j.date)}
                    className={cn(
                      "w-full px-3 py-2 text-left hover:bg-paper",
                      j.date === selected && "bg-vermilion-soft/40"
                    )}
                  >
                    <p className="text-xs font-medium">{formatShort(j.date)}</p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-ink-faint">
                      {j.content.replace(/\n/g, " ").slice(0, 40) || "（空）"}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

function SaveStateBadge({ state }: { state: string }) {
  if (state === "saving") return <Badge tone="gold">保存中…</Badge>;
  if (state === "saved") return <Badge tone="jade">已存</Badge>;
  if (state === "error") return <Badge tone="danger">保存失败</Badge>;
  if (state === "pending") return <Badge tone="neutral">待存…</Badge>;
  return null;
}
