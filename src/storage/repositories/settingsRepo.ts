import { db } from "@/storage/db";

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.appSettings.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.appSettings.put({ key, value });
}
