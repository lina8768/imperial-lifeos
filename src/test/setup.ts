import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { db } from "@/storage/db";

afterEach(() => {
  cleanup();
});

/** 每个测试文件开始前清空 IndexedDB */
beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});
