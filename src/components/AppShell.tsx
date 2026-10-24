import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "总览" },
  { to: "/tasks", label: "今日任务" },
  { to: "/calendar", label: "日历" },
  { to: "/library", label: "人生知识库" },
  { to: "/metrics", label: "数据追踪" },
  { to: "/journals", label: "个人日志" },
  { to: "/reviews", label: "周期复盘" },
];

const MORE_ITEMS = [{ to: "/settings", label: "内务府" }];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      {/* 顶部导航（参考图 04） */}
      <header className="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 lg:gap-6 lg:px-6">
          {/* 品牌 */}
          <NavLink to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="seal h-8 w-8 rounded-lg bg-vermilion text-base text-white">御</span>
            <span className="hidden sm:block">
              <span className="block font-serif text-[15px] font-bold leading-tight tracking-wide">
                御前内政 <span className="text-ink-faint">Imperial LifeOS</span>
              </span>
            </span>
          </NavLink>

          {/* 桌面横向导航 */}
          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto lg:flex" aria-label="主导航">
            {NAV_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                className={({ isActive }) => cn("nav-tab", isActive && "nav-tab-active")}
              >
                {label}
              </NavLink>
            ))}
            {MORE_ITEMS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => cn("nav-tab", isActive && "nav-tab-active")}
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* 移动端更多 */}
          <details className="group relative ml-auto lg:hidden">
            <summary className="flex list-none cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm text-ink-soft hover:bg-paper [&::-webkit-details-marker]:hidden">
              <MoreHorizontal size={18} />
            </summary>
            <div className="absolute right-0 top-full z-40 mt-1 w-40 rounded-xl border border-line bg-card p-1.5 shadow-pop">
              {[...NAV_ITEMS.slice(2), ...MORE_ITEMS].map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className="block rounded-lg px-3 py-2.5 text-sm text-ink-soft hover:bg-paper hover:text-ink"
                >
                  {label}
                </NavLink>
              ))}
            </div>
          </details>
        </div>
      </header>

      {/* 内容区 */}
      <main className="pb-16 lg:pb-10">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-6 lg:py-8">{children}</div>
      </main>

      {/* 移动端底部导航 */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-card lg:hidden" aria-label="底部导航">
        {[
          { to: "/", label: "总览" },
          { to: "/tasks", label: "任务" },
          { to: "/library", label: "典籍" },
          { to: "/metrics", label: "追踪" },
        ].map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px]",
                isActive ? "font-medium text-teal" : "text-ink-faint"
              )
            }
          >
            {label}
          </NavLink>
        ))}
        <MobileMoreButton />
      </nav>
    </div>
  );
}

function MobileMoreButton() {
  return (
    <details className="group relative flex-1">
      <summary className="flex list-none cursor-pointer flex-col items-center gap-0.5 py-2 text-[10px] text-ink-faint [&::-webkit-details-marker]:hidden">
        更多
      </summary>
      <div className="absolute bottom-full right-0 z-40 mb-1 w-40 rounded-xl border border-line bg-card p-1.5 shadow-pop">
        {[...NAV_ITEMS.slice(2), ...MORE_ITEMS].map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className="block rounded-lg px-3 py-2.5 text-sm text-ink-soft hover:bg-paper hover:text-ink"
          >
            {label}
          </NavLink>
        ))}
      </div>
    </details>
  );
}
