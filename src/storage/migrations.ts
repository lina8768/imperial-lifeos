import { db, SCHEMA_VERSION, type SchemaMigration } from "./db";

/**
 * 确保 schema 版本表已初始化并记录当前版本。
 * Dexie 的 version(n).stores() 负责 schema 升级本身；此表用于应用层感知当前结构版本
 * （备份导入校验也依赖它）。
 */
export async function ensureSchemaMigrations(): Promise<void> {
  const existing: SchemaMigration[] = await db.schemaMigrations.toArray();
  for (let v = 1; v <= SCHEMA_VERSION; v++) {
    if (!existing.some((m) => m.version === v)) {
      await db.schemaMigrations.put({ version: v, appliedAt: new Date().toISOString() });
    }
  }
}

export async function getSchemaVersion(): Promise<number> {
  const all = await db.schemaMigrations.toArray();
  return all.length ? Math.max(...all.map((m) => m.version)) : 0;
}
