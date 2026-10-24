import { useEffect, useState, type ReactNode } from "react";
import { seedBookIfNeeded, validateBundledBook } from "@/storage/bookSeed";
import { ensureSchemaMigrations } from "@/storage/migrations";

/**
 * 应用启动 Provider：
 * 1. 校验内置知识库完整性（数量 / 哈希 / ID 唯一性），不完整即抛错。
 * 2. 初始化 schema 版本表；知识库哈希变化时重建 book_* 表（用户数据不受影响）。
 */
export function BookProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await ensureSchemaMigrations();
      validateBundledBook();
      await seedBookIfNeeded();
      if (!cancelled) setState("ready");
    })().catch((err) => {
      console.error("知识库初始化失败", err);
      if (!cancelled) {
        setMessage(err instanceof Error ? err.message : String(err));
        setState("error");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded border border-vermilion bg-vermilion font-serif text-xl text-white">
            御
          </div>
          <p className="text-sm text-ink-soft">御前内政 · 正在整理典籍……</p>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="panel max-w-md p-6">
          <h1 className="mb-2 font-serif text-lg font-semibold text-danger">知识库数据异常</h1>
          <p className="mb-1 text-sm text-ink-soft">
            内置知识库完整性校验未通过，应用拒绝加载不完整数据。请重新运行同步脚本
            <code className="mx-1 rounded bg-paper px-1">npm run sync:book</code>
            后重新构建。
          </p>
          <p className="mt-3 break-all rounded bg-paper p-2 text-xs text-ink-faint">{message}</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
