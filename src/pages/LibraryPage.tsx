import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Star, Plus } from "lucide-react";
import { PageHeader, Input, Select, Badge, Button, EmptyState } from "@/components/ui";
import { Highlight } from "@/components/Highlight";
import { Dialog } from "@/components/Dialog";
import { listChapters, searchEntries, listFavorites, toggleFavorite, type SearchHit } from "@/storage/repositories/libraryRepo";
import { createTask } from "@/storage/repositories/taskRepo";
import { getBookVersion } from "@/storage/bookSeed";
import { type BookChapter, type BookEntry } from "@/storage/db";
import { todayKey } from "@/lib/date";

const SCOPE_LABELS: Record<string, string> = {
  死亡率: "寿命",
  金钱: "金钱",
  时间: "时间",
  自由: "自由",
  未标注: "未标注",
};

export default function LibraryPage() {
  const [chapters, setChapters] = useState<BookChapter[]>([]);
  const [version, setVersion] = useState<Awaited<ReturnType<typeof getBookVersion>>>();
  const [keyword, setKeyword] = useState("");
  const [grade, setGrade] = useState<"all" | "A" | "B" | "C">("all");
  const [scope, setScope] = useState("all");
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [favSet, setFavSet] = useState<Set<string>>(new Set());
  const [taskFrom, setTaskFrom] = useState<BookEntry | null>(null);

  useEffect(() => {
    void (async () => {
      setChapters(await listChapters());
      setVersion(await getBookVersion());
      const favs = await listFavorites();
      setFavSet(new Set(favs.map((f) => f.entryId)));
    })();
  }, []);

  useEffect(() => {
    if (!keyword.trim()) {
      setResults(null);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      const hits = await searchEntries({ keyword, grade, scope });
      setResults(hits);
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [keyword, grade, scope]);

  const scopeOptions = useMemo(() => {
    const s = new Set<string>();
    for (const key in version?.stats.scopes ?? {}) s.add(key);
    return ["all", ...s];
  }, [version]);

  async function onToggleFav(entryId: string) {
    const nowFav = await toggleFavorite(entryId);
    setFavSet((prev) => {
      const next = new Set(prev);
      if (nowFav) next.add(entryId);
      else next.delete(entryId);
      return next;
    });
  }

  const searching_ = keyword.trim().length > 0;

  return (
    <div>
      <PageHeader
        title="内政典籍"
        subtitle={
          version
            ? `《高性价比人生指南》 · ${version.chapterCount} 章 ${version.entryCount} 条 · 证据 A ${version.stats.grades.A ?? 0} / B ${version.stats.grades.B ?? 0} / C ${version.stats.grades.C ?? 0}`
            : undefined
        }
      />

      {/* 搜索栏 */}
      <div className="panel mb-6 flex flex-wrap items-center gap-2 p-3">
        <Search size={16} className="ml-1 shrink-0 text-ink-faint" />
        <Input
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="全文检索：标题、说人话、成本、收益、备注……"
          className="min-w-48 flex-1 border-transparent bg-transparent focus:border-vermilion"
          aria-label="全文搜索"
        />
        <Select value={grade} onChange={(e) => setGrade(e.target.value as "all")} className="w-32" aria-label="证据等级">
          <option value="all">全部证据</option>
          <option value="A">A 级</option>
          <option value="B">B 级</option>
          <option value="C">C 级</option>
        </Select>
        <Select value={scope} onChange={(e) => setScope(e.target.value)} className="w-28" aria-label="口径">
          {scopeOptions.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "全部口径" : (SCOPE_LABELS[s] ?? s)}
            </option>
          ))}
        </Select>
      </div>

      {searching_ ? (
        /* 搜索结果 */
        <div>
          <p className="mb-3 text-xs text-ink-faint">
            {searching ? "检索中……" : `${results?.length ?? 0} 条命中`}
          </p>
          {!searching && results?.length === 0 ? (
            <EmptyState title="未检得相关条目" hint="换个说法试试，例如「血压」「头盔」「公积金」。" />
          ) : (
            <ul className="space-y-2">
              {results?.map(({ entry, snippets }) => (
                <li key={entry.id} className="panel p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link to={`/library/entry/${entry.id}`} className="group min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge tone="gold">{entry.evidenceGrade}{entry.controversial ? "·争议" : ""}</Badge>
                        <Badge tone="neutral">第 {entry.chapterNumber} 章 · {entry.entryNumber} 条</Badge>
                        {entry.tags.scope && <Badge tone="neutral">{SCOPE_LABELS[entry.tags.scope] ?? entry.tags.scope}</Badge>}
                      </div>
                      <h3 className="mt-1.5 font-serif text-sm font-semibold group-hover:text-vermilion">
                        <Highlight text={entry.title} keyword={keyword} />
                      </h3>
                      {snippets.map((s) => (
                        <p key={s.field} className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                          <span className="text-ink-faint">[{s.label}] </span>
                          <Highlight text={s.text} keyword={keyword} />
                        </p>
                      ))}
                    </Link>
                    <div className="flex shrink-0 flex-col gap-1">
                      <button
                        aria-label={favSet.has(entry.id) ? "取消收藏" : "收藏"}
                        onClick={() => void onToggleFav(entry.id)}
                        className={`rounded p-1.5 ${favSet.has(entry.id) ? "text-gold" : "text-ink-faint hover:text-gold"}`}
                      >
                        {favSet.has(entry.id) ? <Star size={15} fill="currentColor" /> : <Star size={15} />}
                      </button>
                      <button
                        aria-label="从此条目创建任务"
                        title="从此条目创建任务"
                        onClick={() => setTaskFrom(entry)}
                        className="rounded p-1.5 text-ink-faint hover:text-vermilion"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        /* 章节目录 */
        <div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {chapters.map((ch) => (
              <li key={ch.id}>
                <Link to={`/library/entry/${ch.id}-e001`} className="panel block p-4 transition-colors hover:border-vermilion/40">
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif text-lg font-semibold text-vermilion">
                      {String(ch.number).padStart(2, "0")}
                    </span>
                    <h3 className="min-w-0 flex-1 truncate font-serif text-sm font-semibold">{ch.title}</h3>
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-soft">{ch.intro.replace(/\n/g, " ")}</p>
                  <p className="mt-2 text-[11px] text-ink-faint">{ch.entryCount} 条建议</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 来源信息页脚 */}
      <footer className="mt-10 border-t border-line pt-4 text-[11px] leading-relaxed text-ink-faint">
        <p>
          本典籍内容来自开源项目《高性价比人生指南》（
          <a className="hover:text-vermilion" href="https://github.com/eternity4719/HowToLiveBetter" target="_blank" rel="noreferrer">
            eternity4719/HowToLiveBetter
          </a>
          ），原文以{" "}
          <a className="hover:text-vermilion" href="https://creativecommons.org/licenses/by/4.0/deed.zh" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>{" "}
          许可发布，作者 eternity4719。本项目为独立衍生应用，不代表原作者官方产品。
        </p>
        {version && (
          <p className="mt-1">
            内容版本：commit {version.commitSha.slice(0, 12)} · 同步于 {version.syncedAt.slice(0, 10)} · 内容哈希 {version.contentHash.slice(0, 16)}…
          </p>
        )}
      </footer>

      {/* 从条目创建任务 */}
      {taskFrom && <CreateTaskFromEntryDialog entry={taskFrom} onClose={() => setTaskFrom(null)} />}
    </div>
  );
}

function CreateTaskFromEntryDialog({ entry, onClose }: { entry: BookEntry; onClose: () => void }) {
  const [title, setTitle] = useState(entry.title);
  const [plannedDate, setPlannedDate] = useState(todayKey());
  const [error, setError] = useState("");

  async function create() {
    if (!title.trim()) {
      setError("任务标题不能为空");
      return;
    }
    await createTask({ title, plannedDate: plannedDate || null, entryId: entry.id });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="从典籍拟奏折" description={`关联条目：${entry.title}`}>
      <div className="space-y-3">
        <div>
          <label className="label" htmlFor="from-entry-title">任务标题</label>
          <Input id="from-entry-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="from-entry-date">计划日期</label>
          <Input id="from-entry-date" type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} />
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end gap-2 border-t border-line pt-3">
          <Button onClick={onClose}>取消</Button>
          <Button variant="primary" onClick={() => void create()}>
            落笔
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
