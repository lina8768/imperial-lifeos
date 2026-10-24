import { describe, it, expect } from "vitest";
import { validateBundledBook, seedBookIfNeeded } from "@/storage/bookSeed";
import { db } from "@/storage/db";
import { searchEntries, getEntry, listChapters, listFavorites, toggleFavorite } from "@/storage/repositories/libraryRepo";

describe("知识库完整性与保真", () => {
  it("内置数据校验通过：章节/条目数量与统计一致、ID 唯一", () => {
    const data = validateBundledBook();
    expect(data.chapters.length).toBeGreaterThan(30);
    expect(data.entries.length).toBeGreaterThan(700);
    // 以实际固定版本为准（同步于 commit e2605d3）
    expect(data.stats.chapterCount).toBe(data.chapters.length);
    expect(data.stats.entryCount).toBe(data.entries.length);
    const gradeSum = Object.values(data.stats.grades).reduce((a, b) => a + b, 0);
    expect(gradeSum).toBe(data.entries.length);
  });

  it("种入 IndexedDB 后条目数一致，二次种入不重复", async () => {
    const rebuilt = await seedBookIfNeeded();
    expect(rebuilt).toBe(true);
    expect(await db.bookEntries.count()).toBe(validateBundledBook().entries.length);
    expect(await db.bookChapters.count()).toBe(validateBundledBook().chapters.length);

    const again = await seedBookIfNeeded();
    expect(again).toBe(false);
    expect(await db.bookEntries.count()).toBe(validateBundledBook().entries.length);
  });

  it("搜索「头盔」能命中并返回片段，详情与搜索一致", async () => {
    await seedBookIfNeeded();
    const hits = await searchEntries({ keyword: "头盔" });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].snippets.length).toBeGreaterThan(0);

    const detail = await getEntry(hits[0].entry.id);
    expect(detail).toBeDefined();
    expect(detail!.id).toBe(hits[0].entry.id);
    expect(detail!.plainTalk).toBe(hits[0].entry.plainTalk);
  });

  it("章节按序排列且可取回", async () => {
    await seedBookIfNeeded();
    const chapters = await listChapters();
    expect(chapters.map((c) => c.number)).toEqual(
      chapters.map((c) => c.number).sort((a, b) => a - b)
    );
    const ch1 = await getEntry("ch01-e001");
    expect(ch1?.title).toContain("安全带");
  });

  it("收藏与取消收藏", async () => {
    await seedBookIfNeeded();
    expect(await toggleFavorite("ch01-e001")).toBe(true);
    expect((await listFavorites()).map((f) => f.entryId)).toContain("ch01-e001");
    expect(await toggleFavorite("ch01-e001")).toBe(false);
    expect((await listFavorites()).length).toBe(0);
  });

  it("交叉引用目标存在", async () => {
    const data = validateBundledBook();
    const ids = new Set(data.entries.map((e) => e.id));
    let crossrefCount = 0;
    for (const e of data.entries) {
      for (const r of e.crossrefs) {
        crossrefCount++;
        expect(ids.has(r.targetEntryId)).toBe(true);
      }
    }
    expect(crossrefCount).toBeGreaterThan(600);
  });
});
