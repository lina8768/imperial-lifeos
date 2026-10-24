/** 生成 UUID v4（优先 crypto.randomUUID） */
export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** 本地日期 → YYYY-MM-DD（不转 UTC，避免时区偏移） */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** YYYY-MM-DD → Date（本地时区） */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(key: string, days: number): string {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function addMonths(key: string, months: number): string {
  const d = fromDateKey(key);
  d.setMonth(d.getMonth() + months);
  return toDateKey(d);
}

/** 周一为一周开始 */
export function startOfWeek(key: string): string {
  const d = fromDateKey(key);
  const day = (d.getDay() + 6) % 7; // 周一=0
  d.setDate(d.getDate() - day);
  return toDateKey(d);
}

export function endOfWeek(key: string): string {
  return addDays(startOfWeek(key), 6);
}

export function startOfMonth(key: string): string {
  return key.slice(0, 7) + "-01";
}

export function endOfMonth(key: string): string {
  const d = fromDateKey(key);
  return toDateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

export function startOfYear(key: string): string {
  return key.slice(0, 4) + "-01-01";
}

export function endOfYear(key: string): string {
  return key.slice(0, 4) + "-12-31";
}

/** 人类可读日期：2026-10-24 → 10月24日（同年省略年份） */
export function formatShort(key: string): string {
  const d = fromDateKey(key);
  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return sameYear
    ? `${d.getMonth() + 1}月${d.getDate()}日`
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
export function weekdayCN(key: string): string {
  return "周" + WEEKDAYS[fromDateKey(key).getDay()];
}

export function isOverdue(dueDate: string | null, status: string): boolean {
  if (!dueDate || status === "done" || status === "cancelled") return false;
  return dueDate < todayKey();
}
