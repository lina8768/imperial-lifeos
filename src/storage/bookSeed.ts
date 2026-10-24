import bookData from "@/data/book-data.json";
import { db, type BookChapter, type BookEntry, type BookVersion, type EntryReference } from "./db";

/** 同步脚本产出的数据文件结构 */
interface BookDataFile {
  version: number;
  source: { repoUrl: string; commitSha: string; syncedAt: string };
  contentHash: string;
  stats: {
    chapterCount: number;
    entryCount: number;
    grades: Record<string, number>;
    scopes: Record<string, number>;
    controversialCount: number;
    crossrefCount: number;
    sourceLinkCount: number;
  };
  chapters: BookChapter[];
  entries: BookEntry[];
}

const data = bookData as unknown as BookDataFile;

export function getBookDataFile(): BookDataFile {
  return data;
}

/**
 * 校验内置知识库数据的完整性：数量与哈希一致性。
 * 任何不匹配都抛错（禁止发布不完整数据）。
 */
export function validateBundledBook(): BookDataFile {
  if (data.stats.chapterCount !== data.chapters.length) {
    throw new Error(
      `知识库章节数不一致：stats=${data.stats.chapterCount}，实际=${data.chapters.length}`
    );
  }
  if (data.stats.entryCount !== data.entries.length) {
    throw new Error(
      `知识库条目数不一致：stats=${data.stats.entryCount}，实际=${data.entries.length}`
    );
  }
  const gradeSum = Object.values(data.stats.grades).reduce((a, b) => a + b, 0);
  if (gradeSum !== data.entries.length) {
    throw new Error(`知识库证据等级分布总数不一致：${gradeSum} ≠ ${data.entries.length}`);
  }
  const ids = new Set(data.entries.map((e) => e.id));
  if (ids.size !== data.entries.length) throw new Error("知识库存在重复条目 ID");
  return data;
}

/**
 * 将内置知识库写入本地 IndexedDB。
 * - 首次运行或内容哈希变化时重建 book_* 表（事务内整体替换）。
 * - 用户数据表（收藏除外，其主键为条目 ID，保持不动）不受影响。
 * 返回是否执行了重建。
 */
export async function seedBookIfNeeded(): Promise<boolean> {
  const valid = validateBundledBook();
  const existing = await db.bookVersions.toCollection().last();
  if (existing && existing.contentHash === valid.contentHash && existing.id === valid.source.commitSha) {
    return false;
  }

  const version: BookVersion = {
    id: valid.source.commitSha,
    repoUrl: valid.source.repoUrl,
    commitSha: valid.source.commitSha,
    syncedAt: valid.source.syncedAt,
    contentHash: valid.contentHash,
    chapterCount: valid.stats.chapterCount,
    entryCount: valid.stats.entryCount,
    stats: valid.stats,
  };

  const references: EntryReference[] = [];
  for (const e of valid.entries) {
    for (const s of e.sources) {
      references.push({
        id: `${e.id}:s${s.index}`,
        entryId: e.id,
        kind: "source",
        text: s.text,
        url: s.url,
        targetEntryId: null,
      });
    }
    e.crossrefs.forEach((r, i) => {
      references.push({
        id: `${e.id}:x${i}`,
        entryId: e.id,
        kind: "crossref",
        text: r.raw,
        url: null,
        targetEntryId: r.targetEntryId,
      });
    });
    e.searchText = buildSearchText(e);
  }

  await db.transaction(
    "rw",
    [db.bookVersions, db.bookChapters, db.bookEntries, db.entryReferences],
    async () => {
      await db.bookVersions.clear();
      await db.bookChapters.clear();
      await db.bookEntries.clear();
      await db.entryReferences.clear();
      await db.bookVersions.put(version);
      await db.bookChapters.bulkPut(valid.chapters);
      await db.bookEntries.bulkPut(valid.entries);
      await db.entryReferences.bulkPut(references);
    }
  );

  // 清理指向已不存在条目的收藏（知识库更新可能移除条目）
  const entryIds = new Set(valid.entries.map((e) => e.id));
  const favorites = await db.entryFavorites.toArray();
  const stale = favorites.filter((f) => !entryIds.has(f.entryId)).map((f) => f.entryId);
  if (stale.length) await db.entryFavorites.bulkDelete(stale);

  return true;
}

export function buildSearchText(e: BookEntry): string {
  return [e.title, e.plainTalk, e.cost, e.benefit, e.note].join("\n");
}

export async function getBookVersion(): Promise<BookVersion | undefined> {
  return db.bookVersions.toCollection().last();
}
