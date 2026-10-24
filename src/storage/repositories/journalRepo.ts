import { db, type DailyJournal } from "@/storage/db";
import { nowISO } from "@/lib/date";

export async function getJournal(date: string): Promise<DailyJournal | undefined> {
  return db.dailyJournals.get(date);
}

export async function saveJournal(date: string, content: string): Promise<DailyJournal> {
  const existing = await db.dailyJournals.get(date);
  const now = nowISO();
  if (existing) {
    const next: DailyJournal = { ...existing, content, updatedAt: now };
    await db.dailyJournals.put(next);
    return next;
  }
  const journal: DailyJournal = {
    id: date,
    date,
    content,
    createdAt: now,
    updatedAt: now,
  };
  await db.dailyJournals.put(journal);
  return journal;
}

export async function listJournals(): Promise<DailyJournal[]> {
  const rows = await db.dailyJournals.toArray();
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}
