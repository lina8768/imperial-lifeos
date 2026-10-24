import { db, type BookEntry } from "@/storage/db";

/**
 * 高性价比行动榜：从 767 条中按「证据硬度 × 收益 × 成本」筛出当前最划算的事。
 *
 * 排序权重（模拟上游「性价比 = 收益 / 成本」的思路）：
 * - 证据等级：A=3, B=2, C=1（A 是随机分组试验/官方统计，最硬）
 * - 收益：大=3, 中=2, 小=1
 * - 成本越低越好：钱（0/少/多 → 0/1/2）+ 时间（少/中/多 → 0/1/2）+ 毅力（否/些/是 → 0/1/2）
 * - 口径加权：死亡率（保命）优先于金钱/时间/自由（上游全书的底层主张）
 * - 已在用户任务中出现过的条目（含软删除）不再重复推荐
 */
export interface ValueEntry extends BookEntry {
  score: number;
}

export async function getTopValueEntries(limit = 6): Promise<ValueEntry[]> {
  const entries = await db.bookEntries.toArray();
  const tasks = await db.tasks.toArray();
  const usedEntryIds = new Set(tasks.filter((t) => t.entryId).map((t) => t.entryId as string));

  const GRADE_W = { A: 3, B: 2, C: 1 } as const;
  const BENEFIT_W = { 2: 3, 1: 2, 0: 1 } as const;
  const SCOPE_W: Record<string, number> = { 死亡率: 1.35, 金钱: 1.2, 时间: 1.1, 自由: 1.15 };

  const scored: ValueEntry[] = [];
  for (const e of entries) {
    const grade = GRADE_W[e.evidenceGrade] ?? 1;
    const benefit = BENEFIT_W[e.tags.benefit as 0 | 1 | 2] ?? 1;
    const money = e.tags.money ?? 1;
    const time = e.tags.time ?? 1;
    const will = e.tags.willpower ?? 1;
    const scope = SCOPE_W[e.tags.scope ?? ""] ?? 1;
    const cost = money + time + will;
    // 性价比 = 证据 × 收益 × 口径加权 / (1 + 成本)
    const score = ((grade * benefit * scope) / (1 + cost)) * (e.controversial ? 0.8 : 1);
    scored.push({ ...e, score });
  }

  return scored
    .filter((e) => !usedEntryIds.has(e.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** 知识库量化统计：已践行 / 收藏 / 证据 A 覆盖等 */
export interface BookAdoptionStats {
  total: number;
  /** 已践行：从条目创建过任务且至少有一条完成的去重条目数 */
  practiced: number;
  /** 进行中：关联任务的条目数（有任务但未完成） */
  inProgress: number;
  favorites: number;
  /** 证据 A 中已践行的数量 */
  gradeAPracticed: number;
  gradeATotal: number;
}

export async function getAdoptionStats(): Promise<BookAdoptionStats> {
  const [entries, tasks, favs] = await Promise.all([
    db.bookEntries.toArray(),
    db.tasks.toArray(),
    db.entryFavorites.toArray(),
  ]);
  const gradeOf = new Map(entries.map((e) => [e.id, e.evidenceGrade]));
  const practicedSet = new Set<string>();
  const startedSet = new Set<string>();
  for (const t of tasks) {
    if (!t.entryId) continue;
    startedSet.add(t.entryId);
    if (t.status === "done") practicedSet.add(t.entryId);
  }
  const gradeAPracticed = [...practicedSet].filter((id) => gradeOf.get(id) === "A").length;
  const gradeATotal = entries.filter((e) => e.evidenceGrade === "A").length;
  return {
    total: entries.length,
    practiced: practicedSet.size,
    inProgress: [...startedSet].filter((id) => !practicedSet.has(id)).length,
    favorites: favs.length,
    gradeAPracticed,
    gradeATotal,
  };
}
