import { type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import {
  ScrollText, LayoutDashboard, CalendarDays, BookOpen, Landmark,
  NotebookPen, ClipboardList, Settings2, MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBookVersionInfo } from "@/components/useBookVersionInfo";

const NAV_ITEMS = [
  { to: "/", label: "御前总览", icon: LayoutDashboard },
  { to: "/tasks", label: "奏折与政务", icon: ScrollText },
  { to: "/calendar", label: "日历", icon: CalendarDays },
  { to: "/library", label: "内政典籍", icon: BookOpen },
  { to: "/metrics", label: "国库与国情", icon: Landmark },
  { to: "/journals", label: "起居注", icon: NotebookPen },
  { to: "/reviews", label: "治理复盘", icon: ClipboardList },
  { to: "/settings", label: "内务府", icon: Settings2 },
];

const MOBILE_MAIN = NAV_ITEMS.slice(0, 4);
const MOBILE_MORE = NAV_ITEMS.slice(4);

export function AppShell({ children }: { children: ReactNode }) {
  const version = useBookVersionInfo();
  return (
    <div className="min-h-screen bg-paper lg:flex">
      {/* 桌面侧边栏 */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-line bg-card lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="seal h-9 w-9 border-vermilion bg-vermilion text-base text-white">御</div>
          <div>
            <div className="font-serif text-base font-semibold leading-tight">御前内政</div>
            <div className="text-[10px] tracking-widest text-ink-faint">IMPERIAL LIFEOS</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-vermilion-soft font-medium text-vermilion-deep"
                    : "text-ink-soft hover:bg-paper hover:text-ink"
                )
              }
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-line px-5 py-3 text-[10px] leading-relaxed text-ink-faint">
          <p>知识库 · 高性价比人生指南</p>
          <p className="truncate">{version ? `版本 ${version.commitSha.slice(0, 8)}` : "加载中…"}</p>
          <p>
            <a
              className="hover:text-vermilion"
              href="https://github.com/eternity4719/HowToLiveBetter"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 4.0 · 上游仓库
            </a>
          </p>
        </div>
      </aside>

      {/* 移动端顶栏 */}
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-card px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="seal h-7 w-7 border-vermilion bg-vermilion text-sm text-white">御</div>
          <span className="font-serif text-sm font-semibold">御前内政</span>
        </div>
        <MobileMoreSheet />
      </div>

      {/* 内容区 */}
      <main className="min-w-0 flex-1 pb-20 lg:pb-0">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</div>
      </main>

      {/* 移动端底部导航 */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-card lg:hidden">
        {MOBILE_MAIN.map(({ to, label, icon: Icon }) => (
          <BottomNavLink key={to} to={to} label={label} icon={Icon} />
        ))}
        <MobileMoreSheetButton />
      </nav>
    </div>
  );
}

function BottomNavLink({ to, label, icon: Icon }: { to: string; label: string; icon: typeof ScrollText }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        cn(
          "flex flex-1 flex-col items-center gap-1 py-2 text-[10px]",
          isActive ? "text-vermilion" : "text-ink-faint"
        )
      }
    >
      <Icon size={18} strokeWidth={1.75} />
      {label}
    </NavLink>
  );
}

function MobileMoreSheet() {
  return (
    <MobileMoreSheetButton>
      <MoreHorizontal size={18} strokeWidth={1.75} />
    </MobileMoreSheetButton>
  );
}

function MobileMoreSheetButton({ children }: { children?: ReactNode }) {
  return (
    <details className="group relative">
      <summary className="flex list-none items-center justify-center px-4 py-2 text-ink-soft [&::-webkit-details-marker]:hidden">
        {children ?? (
          <>
            <MoreHorizontal size={18} strokeWidth={1.75} />
            <span className="text-[10px]">更多</span>
          </>
        )}
      </summary>
      <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded border border-line bg-card p-1 shadow-pop">
        {MOBILE_MORE.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className="flex items-center gap-3 rounded px-3 py-2.5 text-sm text-ink-soft hover:bg-paper hover:text-ink"
          >
            <Icon size={16} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </div>
    </details>
  );
}
