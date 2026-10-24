import { db, type BookChapter, type BookEntry, type EntryFavorite, type EvidenceGrade } from "@/storage/db";
import { buildSearchText } from "@/storage/bookSeed";

export async function listChapters(): Promise<BookChapter[]> {
  const rows = await db.bookChapters.toArray();
  return rows.sort((a, b) => a.number - b.number);
}

export async function getChapter(id: string): Promise<BookChapter | undefined> {
  return db.bookChapters.get(id);
}

export async function getEntry(id: string): Promise<BookEntry | undefined> {
  return db.bookEntries.get(id);
}

export async function listEntriesByChapter(chapterId: string): Promise<BookEntry[]> {
  const rows = await db.bookEntries.where("chapterId").equals(chapterId).toArray();
  return rows.sort((a, b) => a.entryNumber - b.entryNumber);
}

export interface SearchFilters {
  keyword?: string;
  grade?: EvidenceGrade | "all";
  scope?: string;
  chapterId?: string;
}

export interface SearchHit {
  entry: BookEntry;
  /** 命中字段片段 */
  snippets: { field: string; label: string; text: string }[];
}

/** 全文搜索：标题 / 说人话 / 成本 / 收益 / 备注，返回带片段与高亮偏移 */
export async function searchEntries(filters: SearchFilters): Promise<SearchHit[]> {
  const keyword = filters.keyword?.trim().toLowerCase() ?? "";
  let entries: BookEntry[];
  if (filters.chapterId) {
    entries = await listEntriesByChapter(filters.chapterId);
  } else {
    entries = await db.bookEntries.toArray();
    entries.sort((a, b) => a.globalIndex - b.globalIndex);
  }
  if (filters.grade && filters.grade !== "all") {
    entries = entries.filter((e) => e.evidenceGrade === filters.grade);
  }
  if (filters.scope && filters.scope !== "all") {
    entries = entries.filter((e) => (e.tags.scope ?? "未标注") === filters.scope);
  }
  if (!keyword) {
    return entries.map((entry) => ({
      entry,
      snippets: [{ field: "plainTalk", label: "说人话", text: entry.plainTalk.slice(0, 120) }],
    }));
  }
  const hits: SearchHit[] = [];
  for (const e of entries) {
    const text = e.searchText ?? buildSearchText(e);
    if (!text.toLowerCase().includes(keyword)) continue;
    const snippets: SearchHit["snippets"] = [];
    const fields: [string, string, string][] = [
      ["title", "标题", e.title],
      ["plainTalk", "说人话", e.plainTalk],
      ["cost", "成本", e.cost],
      ["benefit", "收益", e.benefit],
      ["note", "备注", e.note],
    ];
    for (const [field, label, value] of fields) {
      const idx = value.toLowerCase().indexOf(keyword);
      if (idx >= 0) {
        const start = Math.max(0, idx - 30);
        const end = Math.min(value.length, idx + keyword.length + 70);
        snippets.push({
          field,
          label,
          text: (start > 0 ? "…" : "") + value.slice(start, end) + (end < value.length ? "…" : ""),
        });
      }
    }
    hits.push({ entry: e, snippets });
  }
  return hits;
}

/* ============ 收藏 ============ */

export async function listFavorites(): Promise<EntryFavorite[]> {
  const rows = await db.entryFavorites.toArray();
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function isFavorite(entryId: string): Promise<boolean> {
  return (await db.entryFavorites.get(entryId)) !== undefined;
}

export async function toggleFavorite(entryId: string): Promise<boolean> {
  const existing = await db.entryFavorites.get(entryId);
  if (existing) {
    await db.entryFavorites.delete(entryId);
    return false;
  }
  await db.entryFavorites.add({ entryId, note: null, createdAt: new Date().toISOString() });
  return true;
}

/** 最近使用的知识条目：最近收藏 + 关联过任务的条目 */
export async function getRecentlyUsed(limit = 5): Promise<BookEntry[]> {
  const favs = await listFavorites();
  const taskEntries = await db.tasks.where("entryId").notEqual("").toArray();
  const recentEntryIds = new Set<string>();
  for (const f of favs.slice(0, limit)) recentEntryIds.add(f.entryId);
  for (const t of taskEntries
    .filter((t) => t.entryId && !t.deletedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)) {
    if (t.entryId) recentEntryIds.add(t.entryId);
  }
  const result: BookEntry[] = [];
  for (const id of recentEntryIds) {
    const e = await db.bookEntries.get(id);
    if (e) result.push(e);
  }
  return result.slice(0, limit);
}

/** 从任务表查关联某条目的任务 */
export async function getTasksForEntry(entryId: string) {
  const rows = await db.tasks.where("entryId").equals(entryId).toArray();
  return rows.filter((t) => !t.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
