# 实施计划 · 御前内政 Imperial LifeOS

## 1. 项目定位

个人生活管理 Web 应用，将开源项目《高性价比人生指南》（HowToLiveBetter）的完整知识库
转化为可阅读、筛选、执行、记录和复盘的个人系统。现代中式「皇帝内政」视觉隐喻，
无账号、无后端、无 AI，数据全部本地存储于 IndexedDB。

## 2. 上游知识库（固定版本）

| 项 | 值 |
| --- | --- |
| 仓库 | https://github.com/eternity4719/HowToLiveBetter |
| Commit SHA | `e2605d3e2242bd6216c9255192b8a8957a08c55a` |
| 同步日期 | 2026-10-24 |
| 章节 | 34 个（book/01 ~ book/34） |
| 条目 | 767 条（A 495 / B 220 / C 52，其中 4 条含争议标注） |
| 正文许可 | CC BY 4.0（book/、docs/、README 文字，见 LICENSE-CONTENT） |
| 代码许可 | MIT（上游 tools/、skills/ 等，本项目未复用其代码） |
| 条目数校验 | 以实际解析结果为准，不写死 767；构建时校验一致性 |

## 3. 技术架构

- **构建**：Vite + React 18 + TypeScript
- **样式**：Tailwind CSS，统一设计令牌（朱红 / 墨黑 / 暖白 / 玉石绿 / 低饱和金）
- **组件**：Radix UI 原语 + 自建可访问组件（shadcn/ui 同类方案）
- **存储**：IndexedDB（Dexie），Repository 抽象层隔离存储与业务
- **路由**：React Router HashRouter（兼容 GitHub Pages 子路径）
- **图表**：Recharts
- **校验**：Zod（备份导入校验、表单校验）
- **测试**：Vitest + React Testing Library（fake-indexeddb）+ Playwright（E2E 冒烟）
- **CI/CD**：GitHub Actions（typecheck → test → build → Pages 部署）

### 分层

```
src/
├── data/          # 上游知识库 JSON（构建产物，由脚本生成，提交入库）
├── storage/       # Dexie 数据库定义 + Repository 抽象
├── domain/        # 业务逻辑（任务状态机、复盘周期计算、指标聚合）
├── components/    # 通用 UI 组件与布局
├── pages/         # 八大页面
├── lib/           # 工具（日期、ID、校验）
└── App / 路由
```

## 4. 知识库流水线

`scripts/sync-book.mjs`（Node ≥ 18，零依赖）：

1. 读取上游 `book/*.md`（路径由参数指定，默认 `../_upstream/HowToLiveBetter`）。
2. 解析章（`# N. 标题`）与条（`### M. 标题` + 元数据注释 + 固定字段）。
3. 保留：章节顺序、条目编号、标题、成本 / 说人话 / 收益 / 证据等级 / 来源 / 备注原文，
   以及 HTML 注释中的成本标签（钱 / 时间 / 毅力 / 收益 / 口径 / 人群）。
4. 来源拆分为结构化引用（文本 + 链接）；正文中的「见第 N 节第 M 条」解析为内部交叉引用。
5. 校验：重复 ID、空正文、缺失字段、交叉引用目标存在性；任何错误即失败退出，不产出文件。
6. 产出 `src/data/book-data.json`：含 commit SHA、同步时间、全局内容哈希、
   章节数 / 条目数 / 证据等级分布等统计与逐条内容。
7. 应用首次加载或哈希变化时重建本地 `book_*` 表；用户表不受影响。

## 5. 关键风险与对策

| 风险 | 对策 |
| --- | --- |
| 上游正文更新导致本地哈希不一致 | 内容哈希逐条 + 全局；知识库更新只重建 book_* 表 |
| 交叉引用「见第 N 节第 M 条」失效 | 同步脚本校验全部引用目标存在，缺失即构建失败 |
| CC BY 4.0 署名要求 | LICENSE-CONTENT + 关于页 + 知识库页脚固定署名与版本声明 |
| 数据体积（上游正文 2.4MB） | JSON 懒加载（路由级代码分割），IndexedDB 建索引 |
| GitHub Pages 子路径 | HashRouter + 相对 base，无需服务端配置 |
| 用户误操作破坏数据 | 破坏性操作二次确认；导出 JSON 备份；导入前 Zod 结构校验 |
| 不同单位指标误合并 | 指标独立图表，聚合仅在同指标内进行 |

## 6. 阶段划分

1. ✅ 环境检查、上游分析、计划与数据模型（本文档 + DATA_MODEL.md + UI_SPEC.md）
2. 应用框架、主题、导航、响应式布局
3. 知识库导入、搜索、详情、来源显示
4. 任务、日历、指标、日志、复盘
5. 内务府（备份 / 恢复 / 设置 / 数据校验）
6. 测试、文档、GitHub Actions 与 Pages

每阶段结束运行类型检查与相关测试，问题先修复再加新功能。
