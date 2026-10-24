# 数据模型 · 御前内政 Imperial LifeOS

存储：IndexedDB（Dexie），库名 `imperial-lifeos`。
原书数据（`book_*` 表，只读，随知识库版本整体重建）与用户数据（其余表）严格分离。
所有用户实体使用 UUID v4；时间戳为 ISO 8601 字符串（UTC）。
软删除：任务与指标使用 `deletedAt`，日志与复盘直接编辑修改。

## 表结构

### book_versions — 知识库版本

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 版本 ID = commit SHA |
| repoUrl | string | 上游仓库地址 |
| commitSha | string | 固定 commit SHA |
| syncedAt | string | 同步时间 |
| contentHash | string | 全局内容哈希（SHA-256） |
| chapterCount | number | 章节数 |
| entryCount | number | 条目数 |
| stats | object | 证据等级 / 口径分布统计 |

### book_chapters — 章节

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | `ch01` … `ch34` |
| number | number | 章序号 |
| title | string | 章标题（不含序号） |
| fileName | string | 上游文件名 |
| order | number | 排序序 |
| intro | string | 章导语原文（条目列表之前的正文） |
| entryCount | number | 本章条目数 |
| contentHash | string | 章内容哈希 |

### book_entries — 条目（正文只读）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | `ch01-e001`（章号 + 章内条号，稳定） |
| chapterId | string | 所属章 |
| chapterNumber | number | 冗余，便于筛选 |
| entryNumber | number | 章内条号 |
| globalIndex | number | 全书序号（1 起） |
| title | string | 条目标题原文 |
| cost | string | 成本字段原文 |
| plainTalk | string | 说人话原文 |
| benefit | string | 收益字段原文 |
| evidenceGrade | 'A'\|'B'\|'C' | 证据等级 |
| controversial | boolean | 是否标注争议 |
| gradeNote | string? | 等级后附加说明（如「指南强推荐…」） |
| tags | object | 成本标签：`{ money: 0|1|2, time: 0|1|2, willpower: 0|1|2, benefit: 2|1|0, scope: string, audience?: string }`（钱/时间/毅力：0=无/低 1=中/少 2=高/多；benefit：2=大 1=中 0=小） |
| note | string | 备注原文 |
| searchText | string | 检索用拼接文本（标题+说人话+成本+收益+备注） |
| contentHash | string | 条目内容哈希 |

### entry_references — 条目引用

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | `{entryId}:s{序号}` / `{entryId}:x{序号}` |
| entryId | string | 所属条目 |
| kind | 'source'\|'crossref' | 外部来源 / 内部交叉引用 |
| text | string | 引用文本 |
| url | string? | 外部链接（autolink 提取） |
| targetEntryId | string? | 交叉引用目标条目 ID |

### entry_favorites — 收藏（用户数据）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| entryId | string | 主键 = book_entries.id（知识库重建后仍有效） |
| note | string? | 个人备注 |
| createdAt | string | |

### tasks — 任务（奏折）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string (UUID) | |
| title | string | 必填 |
| description | string | 详情 / 备注 |
| status | 'todo'\|'doing'\|'done'\|'cancelled' | |
| priority | 'low'\|'medium'\|'high'\|'urgent' | |
| plannedDate | string? | 计划日期 YYYY-MM-DD |
| dueDate | string? | 截止日期 |
| completedAt | string? | 完成时间（与计划/截止区分） |
| parentId | string? | 父任务，构成子任务 |
| entryId | string? | 关联原书条目 |
| recurrence | 'none'\|'daily'\|'weekly'\|'monthly' | 周期任务 |
| createdAt / updatedAt | string | |
| deletedAt | string? | 软删除 |

子任务进度 = 父任务下未删除子任务的完成比例；父任务不自动完成。
周期任务完成时生成下一周期的实例（按 recurrence 推进 plannedDate）。

### task_logs — 任务过程记录

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string (UUID) | |
| taskId | string | |
| type | 'status'\|'note' | 状态变更 / 手动记录 |
| fromStatus / toStatus | string? | 状态变更前后值 |
| text | string? | 手动记录内容 |
| createdAt | string | |

### metrics — 指标

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string (UUID) | |
| name | string | 指标名 |
| unit | string | 单位（kg、小时、元、次…） |
| dataType | 'number'\|'count'\|'duration'\|'money'\|'boolean' | |
| frequency | 'daily'\|'weekly'\|'monthly'\|'irregular' | 记录频率 |
| targetValue | number? | 可选目标值 |
| createdAt / updatedAt / deletedAt | | |

### metric_records — 指标记录

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string (UUID) | |
| metricId | string | |
| date | string | YYYY-MM-DD |
| value | number \| boolean | 布尔存 0/1 |
| note | string? | |
| createdAt / updatedAt | string | |

### daily_journals — 起居注（按日期一条）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 主键 = 日期 YYYY-MM-DD |
| date | string | 冗余 |
| content | string | 正文 |
| createdAt / updatedAt | string | |

### reviews — 治理复盘

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string (UUID) | |
| periodType | 'daily'\|'weekly'\|'monthly'\|'yearly' | |
| startDate / endDate | string | 周期起止 YYYY-MM-DD |
| content | string | 复盘文本 |
| createdAt / updatedAt | string | |

### review_actions — 复盘行动

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string (UUID) | |
| reviewId | string | 所属复盘 |
| taskId | string | 转化生成的任务 ID（创建于 tasks 表） |
| createdAt | string | |

### app_settings — 应用设置

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| key | string | 主键 |
| value | any | |

### schema_migrations — 结构版本

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| version | number | 已应用的 Dexie schema 版本 |
| appliedAt | string | |

## 备份格式（导出 / 导入）

```json
{
  "app": "imperial-lifeos",
  "schemaVersion": 1,
  "exportedAt": "ISO-8601",
  "bookVersion": { "commitSha": "...", "contentHash": "..." },
  "data": {
    "tasks": [...], "taskLogs": [...], "metrics": [...],
    "metricRecords": [...], "journals": [...], "reviews": [...],
    "reviewActions": [...], "entryFavorites": [...], "appSettings": [...]
  }
}
```

导入前用 Zod 校验结构与版本；冲突时由用户确认覆盖（整体替换或合并跳过已有 ID）。
导出文件不进入 Git（.gitignore 排除 `*.lifeos.json` 与 `backups/`）。

## Dexie 索引

```ts
db.version(1).stores({
  bookVersions: 'id',
  bookChapters: 'id, number',
  bookEntries: 'id, chapterId, chapterNumber, evidenceGrade, [chapterNumber+entryNumber]',
  entryReferences: 'id, entryId, [kind+entryId]',
  entryFavorites: 'entryId, createdAt',
  tasks: 'id, parentId, status, plannedDate, dueDate, entryId, updatedAt, *searchTokens',
  taskLogs: 'id, taskId, createdAt',
  metrics: 'id, name',
  metricRecords: 'id, metricId, date, [metricId+date]',
  dailyJournals: 'id, date',
  reviews: 'id, periodType, startDate',
  reviewActions: 'id, reviewId, taskId',
  appSettings: 'key',
  schemaMigrations: 'version',
});
```
