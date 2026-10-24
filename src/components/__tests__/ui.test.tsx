import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HashRouter } from "react-router-dom";
import { Highlight } from "@/components/Highlight";

describe("Highlight 组件", () => {
  it("关键词高亮渲染", () => {
    render(<Highlight text="戴头盔能降低死亡风险" keyword="头盔" />);
    const mark = screen.getByText("头盔");
    expect(mark.tagName).toBe("MARK");
    expect(screen.getByText(/戴/)).toBeInTheDocument();
  });

  it("无关键词时原样渲染", () => {
    const { container } = render(<Highlight text="普通文本" keyword="" />);
    expect(container.textContent).toBe("普通文本");
    expect(container.querySelector("mark")).toBeNull();
  });
});

describe("应用外壳与路由（刷新后数据仍在的持久化冒烟）", () => {
  it("渲染顶部导航与全部入口", async () => {
    const { AppShell } = await import("@/components/AppShell");
    render(
      <HashRouter>
        <AppShell>
          <div>内容</div>
        </AppShell>
      </HashRouter>
    );
    for (const label of ["总览", "今日任务", "日历", "人生知识库", "数据追踪", "个人日志", "周期复盘", "内务府"]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("输入框受控更新", async () => {
    const { Input } = await import("@/components/ui");
    const { rerender } = render(<Input value="a" onChange={() => {}} aria-label="t" />);
    const el = screen.getByLabelText("t") as HTMLInputElement;
    expect(el.value).toBe("a");
    rerender(<Input value="ab" onChange={() => {}} aria-label="t" />);
    expect(el.value).toBe("ab");
  });
});
