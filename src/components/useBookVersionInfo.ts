import { useSyncExternalStore } from "react";
import { db, type BookVersion } from "@/storage/db";
import { getBookVersion } from "@/storage/bookSeed";

let cached: BookVersion | undefined;
let listeners: (() => void)[] = [];
let loaded = false;

async function load() {
  cached = await getBookVersion();
  loaded = true;
  listeners.forEach((l) => l());
}

export function useBookVersionInfo(): BookVersion | undefined {
  useSyncExternalStore(
    (onChange) => {
      listeners.push(onChange);
      if (!loaded) void load();
      return () => {
        listeners = listeners.filter((l) => l !== onChange);
      };
    },
    () => cached,
    () => undefined
  );
  return cached;
}

/** 数据变化时刷新版本信息（例如重新导入后） */
export function invalidateBookVersionCache(): void {
  cached = undefined;
  loaded = false;
  void load();
}

export { db };
