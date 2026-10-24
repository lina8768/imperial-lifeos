import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Star, Plus } from "lucide-react";
import { Badge, Button, Input } from "@/components/ui";
import { Dialog } from "@/components/Dialog";
import { getEntry, getChapter, listEntriesByChapter, toggleFavorite, isFavorite, getTasksForEntry } from "@/storage/repositories/libraryRepo";
import { createTask } from "@/storage/repositories/taskRepo";
import type { BookEntry, BookChapter, Task } from "@/storage/db";
import { todayKey } from "@/lib/date";
import { TaskStatusBadge } from "@/components/taskBadges";

const BENEFIT_LABELS = { 2: "收益大", 1: "收益中", 0: "收益小" } as const;
const MONEY_LABELS = { 0: "不花钱", 1: "花钱少", 2: "花钱多" } as const;
const TIME_LABELS = { 0: "省时", 1: "费些时", 2: "费时" } as const;
const WILL_LABELS = { 0: "不靠毅力", 1: "要点毅力", 2: "很靠毅力" } as const;

export default function EntryDetailPage() {
  const { entryId } = useParams<{ entryId: string }>();
  const navigate = useNavigate();
  const [entry, setEntry] = useState<BookEntry | null>(null);
  const [chapter, setChapter] = useState<BookChapter | null>(null);
  const [siblings, setSiblings] = useState<BookEntry[]>([]);
  const [fav, setFav] = useState(false);
  const [relatedTasks, setRelatedTasks] = useState<Task[]>([]);
  const [taskDialog, setTaskDialog] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!entryId) return;
    void (async () => {
      const e = await getEntry(entryId);
      if (!e) {
        setNotFound(true);
        return;
      }
      setNotFound(false);
      setEntry(e);
      setChapter((await getChapter(e.chapterId)) ?? null);
      setSiblings(await listEntriesByChapter(e.chapterId));
      setFav(await isFavorite(e.id));
      setRelatedTasks(await getTasksForEntry(e.id));
    })();
  }, [entryId]);

  if (notFound) {
    return (
      <div className="panel p-8 text-center">
        <p className="mb-3 text-sm text-ink-soft">未找到该典籍条目。</p>
        <Button onClick={() => navigate("/library")}>返回典籍</Button>
      </div>
    );
  }

  if (!entry) {
    return <p className="p-4 text-sm text-ink-faint">加载中……</p>;
  }

  const idx = siblings.findIndex((s) => s.id === entry.id);
  const prev = idx > 0 ? siblings[idx - 1] : null;
  const next = idx < siblings.length - 1 ? siblings[idx + 1] : null;

  async function onToggleFav() {
    const nowFav = await toggleFavorite(entry!.id);
    setFav(nowFav);
  }

  return (
    <div>
      {/* 面包屑 */}
      <div className="mb-4 flex items-center gap-2 text-xs text-ink-faint">
        <Link to="/library" className="hover:text-vermilion">内政典籍</Link>
        {chapter && (
          <>
            <span>/</span>
            <span>
              第 {chapter.number} 章 · {chapter.title}
            </span>
          </>
        )}
      </div>

      <article className="panel p-5 sm:p-7">
        {/* 头部 */}
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              <Badge tone="gold">
                证据 {entry.evidenceGrade}
                {entry.controversial && " · 争议"}
              </Badge>
              <Badge tone="neutral">
                第 {entry.chapterNumber} 章 第 {entry.entryNumber} 条 · 全书第 {entry.globalIndex} 条
              </Badge>
              {entry.tags.scope && <Badge tone="neutral">口径：{entry.tags.scope}</Badge>}
              {entry.tags.audience && <Badge tone="neutral">人群：{entry.tags.audience}</Badge>}
            </div>
            <h1 className="font-serif text-xl font-semibold leading-snug">{entry.title}</h1>
            {entry.gradeNote && <p className="mt-1 text-xs text-ink-faint">等级说明：{entry.gradeNote}</p>}
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={() => void onToggleFav()} aria-label={fav ? "取消收藏" : "收藏"}>
              <Star size={13} fill={fav ? "currentColor" : "none"} className={fav ? "text-gold" : ""} />
              {fav ? "已收藏" : "收藏"}
            </Button>
            <Button size="sm" variant="primary" onClick={() => setTaskDialog(true)}>
              <Plus size={13} /> 拟奏折
            </Button>
          </div>
        </div>

        {/* 成本标签可视化 */}
        <div className="mb-5 flex flex-wrap gap-1.5">
          {entry.tags.benefit !== null && <Badge tone="jade">{BENEFIT_LABELS[entry.tags.benefit as 0 | 1 | 2]}</Badge>}
          {entry.tags.money !== null && <Badge tone="neutral">{MONEY_LABELS[entry.tags.money as 0 | 1 | 2]}</Badge>}
          {entry.tags.time !== null && <Badge tone="neutral">{TIME_LABELS[entry.tags.time as 0 | 1 | 2]}</Badge>}
          {entry.tags.willpower !== null && <Badge tone="neutral">{WILL_LABELS[entry.tags.willpower as 0 | 1 | 2]}</Badge>}
        </div>

        {/* 正文字段 */}
        <div className="space-y-5">
          <Field label="说人话" tone="vermilion">{entry.plainTalk}</Field>
          <Field label="成本" tone="gold">{entry.cost}</Field>
          <Field label="收益">{entry.benefit}</Field>

          {/* 来源 */}
          <section>
            <h2 className="mb-2 font-serif text-sm font-semibold text-vermilion">来源</h2>
            <ol className="space-y-2">
              {entry.sources.map((s) => (
                <li key={s.index} className="rounded border border-line bg-paper p-3 text-xs leading-relaxed text-ink-soft">
                  {s.text}
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 block break-all text-vermilion hover:underline"
                    >
                      {s.url}
                    </a>
                  )}
                </li>
              ))}
            </ol>
          </section>

          <Field label="备注">{entry.note}</Field>

          {/* 交叉引用 */}
          {entry.crossrefs.length > 0 && (
            <section>
              <h2 className="mb-2 font-serif text-sm font-semibold text-gold">相关条目</h2>
              <div className="flex flex-wrap gap-1.5">
                {dedupeCrossrefs(entry.crossrefs).map((r) => (
                  <Link
                    key={r.targetEntryId}
                    to={`/library/entry/${r.targetEntryId}`}
                    className="rounded border border-line bg-paper px-2 py-1 text-xs text-ink-soft hover:border-vermilion/40 hover:text-vermilion"
                  >
                    {r.raw}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>

      {/* 关联任务 */}
      {relatedTasks.length > 0 && (
        <section className="mt-4">
          <h2 className="mb-2 font-serif text-sm font-semibold text-ink-soft">由此条目拟的奏折</h2>
          <ul className="panel divide-y divide-line">
            {relatedTasks.map((t) => (
              <li key={t.id}>
                <Link to={`/tasks?focus=${t.id}`} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-paper">
                  <TaskStatusBadge status={t.status} />
                  <span className="min-w-0 flex-1 truncate text-sm">{t.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 上一条 / 下一条 */}
      <div className="mt-4 flex items-center justify-between">
        {prev ? (
          <Link to={`/library/entry/${prev.id}`} className="panel flex items-center gap-1.5 px-3 py-2 text-xs text-ink-soft hover:text-vermilion">
            <ArrowLeft size={13} /> 上一条
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/library/entry/${next.id}`} className="panel flex items-center gap-1.5 px-3 py-2 text-xs text-ink-soft hover:text-vermilion">
            下一条 <ArrowRight size={13} />
          </Link>
        ) : (
          <span />
        )}
      </div>

      {/* 创建任务对话框 */}
      {taskDialog && (
        <CreateTaskDialog entry={entry} onClose={() => setTaskDialog(false)} onCreated={async () => setRelatedTasks(await getTasksForEntry(entry.id))} />
      )}
    </div>
  );
}

function Field({ label, tone, children }: { label: string; tone?: "vermilion" | "gold"; children: string }) {
  return (
    <section>
      <h2 className={`mb-2 font-serif text-sm font-semibold ${tone === "vermilion" ? "text-vermilion" : tone === "gold" ? "text-gold" : "text-ink"}`}>
        {label}
      </h2>
      <p className="text-sm leading-7 text-ink">{children}</p>
    </section>
  );
}

function dedupeCrossrefs(refs: BookEntry["crossrefs"]) {
  const seen = new Set<string>();
  return refs.filter((r) => {
    if (seen.has(r.targetEntryId)) return false;
    seen.add(r.targetEntryId);
    return true;
  });
}

function CreateTaskDialog({ entry, onClose, onCreated }: { entry: BookEntry; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState(entry.title);
  const [plannedDate, setPlannedDate] = useState(todayKey());

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="从典籍拟奏折" description={`关联：${entry.title}`}>
      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="entry-task-title">任务标题</label>
          <Input id="entry-task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="entry-task-date">计划日期</label>
          <Input id="entry-task-date" type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button onClick={onClose}>取消</Button>
          <Button
            variant="primary"
            onClick={async () => {
              if (!title.trim()) return;
              await createTask({ title, plannedDate: plannedDate || null, entryId: entry.id });
              onCreated();
              onClose();
            }}
          >
            落笔
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
