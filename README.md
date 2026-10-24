# 御前内政 Imperial LifeOS

> 基于《高性价比人生指南》的个人生活管理系统。现代中式、本地优先、无账号、无后端。

将开源项目《高性价比人生指南》（767 条建议、来源只引期刊论文与官方文件）的完整知识库，
转化为可以**阅读、筛选、执行、记录和复盘**的个人系统。视觉采用「皇帝内政」隐喻
（奏折=任务、典籍=知识库、国库=指标、起居注=日志、治理复盘=周期复盘），仅作交互层氛围，
不开发游戏机制。

## 核心特性

- **内政典籍**：完整导入上游 34 章 / 767 条建议，全文检索 + 关键词高亮 + 证据等级筛选
  + 外部来源链接 + 内部交叉引用跳转；正文只读，零改写。
- **奏折与政务**：任务 CRUD、状态机（待办/进行/已成/已撤）、优先级、计划/截止/完成三种
  日期、父-子任务与进度、过程记录、关联典籍条目、周期任务（日/周/月）。
- **日历**：月视图，按计划/截止分色，选中日只读查看当日任务并跳转详情。
- **国库与国情**：自定义指标（数值/次数/时长/金额/布尔），独立折线图 + 时间范围筛选
  + 目标值达成；不同单位指标不混算。
- **起居注**：按日期的日志，防抖自动保存，联动展示当日任务与当日复盘。
- **治理复盘**：日 / 周 / 月 / 年四周期，周期内任务完成率与指标趋势摘要，
  复盘结论一条条转化为新任务（关联回溯）。
- **御前总览**：今日待办/已成/逾期、快速创建、今日复盘入口、最近指标变化、最近典籍。
- **内务府**：JSON 备份导出 / Zod 结构校验 / 冲突预览 / 二次确认的覆盖恢复；
  知识库版本与哈希档案；基础设置。
- **数据安全**：全部本地 IndexedDB，无账号、无后端、无 AI、无追踪；
  破坏性操作一律二次确认；个人数据不进 Git。

## 技术栈

React 18 · TypeScript · Vite · Tailwind CSS · Radix UI · Dexie (IndexedDB) ·
React Router (HashRouter) · Recharts · Zod · Vitest + RTL + Playwright。

代码分层：`data/`（知识库 JSON 产物） · `storage/`（Dexie + Repository 抽象） ·
`domain` 内聚于 repository · `components/` · `pages/`。原书数据与用户数据表严格分离。

## 快速开始

```bash
# 1. 安装依赖
npm install

# 2. （可选）重新同步上游知识库
#    需先将上游仓库 clone 到 ../_upstream/HowToLiveBetter
#    仓库已内置 commit e2605d3 的 JSON，无需手动同步即可运行
npm run sync:book

# 3. 本地开发
npm run dev          # http://localhost:5173

# 4. 类型检查 + 测试 + 构建
npm run typecheck
npm test
npm run build
npm run preview      # 本地预览 dist/
```

测试覆盖：

- 知识库完整性与交叉引用目标存在性（`src/storage/__tests__/book.test.ts`）
- 任务 CRUD / 子任务进度 / 状态机 / 周期任务（`task.test.ts`）
- 指标记录同日覆盖 / 布尔拒绝非法值 / 删除级联（`workflows.test.ts`）
- 复盘周期范围计算 / 复盘行动转化 / 备份导入导出往返 / Zod 拦截非法备份（同上）
- 路由外壳渲染冒烟（`src/components/__tests__/ui.test.tsx`）

## 数据与备份

- 全部数据存于浏览器本地 IndexedDB（库名 `imperial-lifeos`）。
- 在「内务府」导出 JSON 备份（`*.lifeos.json`），换机 / 清缓存前务必导出。
- 导入时 Zod 校验结构、版本与字段；冲突会预览「当前 / 备份中」条数对比；
  恢复是整体替换式，二次确认后执行；不会动到本地内置的知识库正文。
- 备份文件本身不进 Git（`.gitignore` 已排除 `*.lifeos.json` 与 `backups/`）。

## 部署到 GitHub Pages

仓库内置 GitHub Actions 工作流 `.github/workflows/ci.yml`：
拉取依赖 → 类型检查 → 运行 Vitest → 构建 Vite 静态产物 → 部署 `dist/` 到 Pages。

1. 在 GitHub 创建仓库（如 `<your-name>/imperial-lifeos`）。
2. 推送代码后，到仓库 **Settings → Pages → Build and deployment → Source** 选择
   **GitHub Actions**，工作流会自动部署。
3. 因应用使用 HashRouter，部署到任意子路径（`https://<user>.github.io/imperial-lifeos/`）
   均无需额外路由配置；`vite.config.ts` 中 `base: "./"` 保证资源相对路径正确加载。

未经用户明确授权，不会自动推送任何代码到未配置的远程仓库。

## 知识库版本与许可

- 原作品：《高性价比人生指南》 · 原作者：eternity4719
- 上游仓库：https://github.com/eternity4719/HowToLiveBetter
- 内容版本 commit：`e2605d3e2242bd6216c9255192b8a8957a08c55a`（同步于 2026-10-24）
- 内置统计：34 章 / 767 条 · 证据 A 495 / B 220 / C 52 · 699 条内部交叉引用 ·
  762 条带外部链接
- 正文许可：[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.zh)
- 应用代码许可：MIT（见 `LICENSE`）
- 内容与代码许可分离声明见 `LICENSE-CONTENT`

本项目为独立衍生应用，与原作者无关联、不代表官方产品。原书正文仅作显示层排版，
未做任何改写、删减或摘要；运行时校验内容哈希，不一致即拒绝加载。

## 目录结构

```
imperial-lifeos/
├── docs/                  # 实施计划 / 数据模型 / UI 规范
│   ├── IMPLEMENTATION_PLAN.md
│   ├── DATA_MODEL.md
│   └── UI_SPEC.md
├── scripts/
│   └── sync-book.mjs      # 上游知识库同步脚本（零依赖 Node）
├── src/
│   ├── data/book-data.json # 同步产物（提交入库，约 1.5MB）
│   ├── storage/           # Dexie + Repository 抽象
│   │   ├── db.ts
│   │   ├── bookSeed.ts
│   │   ├── migrations.ts
│   │   └── repositories/
│   ├── components/        # AppShell / Dialog / ui / Highlight / useAutoSave
│   ├── pages/             # 八大页面
│   ├── lib/               # date / utils
│   └── test/              # Vitest setup
├── .github/workflows/ci.yml
├── LICENSE                # 应用代码 MIT
├── LICENSE-CONTENT        # 原书正文 CC BY 4.0 声明
└── README.md
```

## 已知限制与后续扩展

- 第一版无 AI、无云同步；`storage` 层已抽象为 Repository，未来可替换实现接入云端。
- 移动端「更多」入口用原生 `<details>` 抽屉，未做手势交互。
- 指标图表仅折线图，未做柱状 / 饼图等多视图。
- Playwright E2E 仅配置（未在 CI 默认运行浏览器，避免外部依赖），可本地 `npm run e2e`。
