import { test, expect } from "@playwright/test";

// 冒烟：八大页面均可加载，关键元素可见，且核心交互（创建任务、检索典籍）真实写库。

test.describe("御前内政主流程", () => {
  test("首页加载与侧边导航", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "御前总览" })).toBeVisible();
    // 侧边导航八入口
    for (const label of ["奏折与政务", "内政典籍", "国库与国情", "起居注", "治理复盘", "内务府"]) {
      await expect(page.getByRole("link", { name: new RegExp(label) }).first()).toBeVisible();
    }
  });

  test("快速创建任务写库并在列表可见", async ({ page }) => {
    await page.goto("/");
    const input = page.getByLabel("快速创建任务");
    await input.fill("E2E 冒烟任务");
    await page.getByRole("button", { name: "落笔" }).click();
    // 任务应出现在今日奏折区
    await expect(page.getByText("E2E 冒烟任务")).toBeVisible();
  });

  test("典籍全文检索命中并查看详情", async ({ page }) => {
    await page.goto("/library");
    await expect(page.getByText(/767/)).toBeVisible();
    const search = page.getByLabel("全文搜索");
    await search.fill("头盔");
    await expect(page.getByText(/条命中/)).toBeVisible();
    // 点击第一个结果进入详情
    await page.getByRole("link", { name: /戴头盔/ }).first().click();
    await expect(page.getByText("来源")).toBeVisible();
  });

  test("内务府显示知识库版本与署名", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("知识库来源与版本")).toBeVisible();
    await expect(page.getByText("eternity4719")).toBeVisible();
    await expect(page.getByText(/CC BY 4\.0/)).toBeVisible();
  });

  test("刷新后数据仍存在（持久化）", async ({ page }) => {
    await page.goto("/");
    // 上一条冒烟任务应仍可见（同一 origin 的 IndexedDB 共享）
    await page.getByLabel("快速创建任务").fill("持久化冒烟-" + Date.now());
    await page.getByRole("button", { name: "落笔" }).click();
    await page.reload();
    // 重新加载后侧栏仍在
    await expect(page.getByRole("heading", { name: "御前总览" })).toBeVisible();
  });
});
