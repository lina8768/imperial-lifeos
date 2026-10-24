#!/usr/bin/env node
/**
 * 知识库同步脚本：将上游《高性价比人生指南》book/*.md 解析为应用使用的 JSON。
 *
 * 用法：
 *   node scripts/sync-book.mjs [上游仓库路径] [--sha <commit>] [--out <输出路径>]
 *
 * 保真要求：
 *   1. 保留原始章节顺序、编号和正文（不改写、不摘要）。
 *   2. 保留元数据（成本标签）、来源链接、交叉引用。
 *   3. 校验：重复 ID、空正文、缺失字段、交叉引用目标存在性。失败即退出非零，不产出文件。
 *   4. 产出可重复构建的数据文件（含 commit SHA、同步时间、内容哈希、统计）。
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const repoPath = resolve(
  args.find((a) => !a.startsWith("--")) ?? "../_upstream/HowToLiveBetter"
);
const outPath = flag("--out", "src/data/book-data.json");
const REPO_URL = "https://github.com/eternity4719/HowToLiveBetter";

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function getCommitSha() {
  const explicit = flag("--sha");
  if (explicit) return explicit;
  try {
    return execSync("git rev-parse HEAD", { cwd: repoPath, encoding: "utf8" }).trim();
  } catch {
    fail(`无法读取上游仓库 commit SHA（${repoPath} 不是 git 仓库），可用 --sha 显式指定`);
    return "";
  }
}

/** 解析条目元数据注释：<!-- 成本标签: 钱=0 时间=少 毅力=否 收益=大 口径=死亡率 人群=... --> */
function parseTags(comment) {
  const tags = {};
  const re = /(\S+)=([^ >]+)/g;
  let m;
  while ((m = re.exec(comment))) {
    tags[m[1]] = m[2];
  }
  const moneyMap = { "0": 0, 少: 1, 多: 2 };
  const timeMap = { 少: 0, 中: 1, 多: 2 };
  const willMap = { 否: 0, 些: 1, 是: 2 };
  const benefitMap = { 大: 2, 中: 1, 小: 0 };
  return {
    money: moneyMap[tags["钱"]] ?? null,
    time: timeMap[tags["时间"]] ?? null,
    willpower: willMap[tags["毅力"]] ?? null,
    benefit: benefitMap[tags["收益"]] ?? null,
    scope: tags["口径"] ?? null,
    audience: tags["人群"] ?? null,
  };
}

/** 从来源文本拆分出结构化引用 */
function parseSources(raw) {
  // 来源由中文分号或英文分号分隔
  const parts = raw
    .split(/[；;]\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.map((text, i) => {
    const urls = [...text.matchAll(/<((?:https?):\/\/[^>]+)>/g)].map((m) => m[1]);
    const bare = [...text.matchAll(/(?<!<)(https?:\/\/[^\s<>)；;，。]+)/g)].map((m) => m[1]);
    const url = urls[0] ?? bare[0] ?? null;
    return { index: i, text, url };
  });
}

/** 解析交叉引用：「第 N 节第 M 条」「本节第 M 条」「第 M 条」（限备注/说人话等正文内） */
function parseCrossrefs(text, chapterNumber) {
  const refs = [];
  const seen = new Set();
  const push = (ch, en, raw) => {
    const key = `${ch}:${en}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ chapterNumber: ch, entryNumber: en, raw });
    }
  };
  for (const m of text.matchAll(/第\s*(\d+)\s*节\s*第\s*(\d+)\s*条/g)) {
    push(Number(m[1]), Number(m[2]), m[0]);
  }
  for (const m of text.matchAll(/本节第\s*(\d+)\s*条/g)) {
    push(chapterNumber, Number(m[1]), m[0]);
  }
  return refs;
}

/** 解析一章 Markdown */
function parseChapter(fileName, fileContent, order) {
  const lines = fileContent.split(/\r?\n/);
  // 章标题：# N. 标题
  const headerIdx = lines.findIndex((l) => /^#\s+\d/.test(l));
  if (headerIdx < 0) {
    fail(`${fileName}: 找不到章标题（# N. …）`);
    return null;
  }
  const headerMatch = lines[headerIdx].match(/^#\s+(\d+)\.\s*(.+)$/);
  if (!headerMatch) {
    fail(`${fileName}: 章标题格式异常：${lines[headerIdx]}`);
    return null;
  }
  const number = Number(headerMatch[1]);
  const title = headerMatch[2].trim();

  const chapter = {
    id: `ch${String(number).padStart(2, "0")}`,
    number,
    title,
    fileName,
    order,
    intro: "",
    entryCount: 0,
    contentHash: "",
  };

  // 条目切分
  const entryBlocks = [];
  let current = null;
  let introLines = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    const em = line.match(/^###\s+(\d+)\.\s*(.+)$/);
    if (em) {
      if (current) entryBlocks.push(current);
      current = { entryNumber: Number(em[1]), title: em[2].trim(), startLine: i + 1, lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else {
      introLines.push(line);
    }
  }
  if (current) entryBlocks.push(current);
  chapter.intro = introLines.join("\n").trim();
  chapter.entryCount = entryBlocks.length;
  return { chapter, entryBlocks };
}

/** 解析一个条目块 */
function parseEntry(block, chapter, globalIndex) {
  const id = `${chapter.id}-e${String(block.entryNumber).padStart(3, "0")}`;
  const raw = block.lines.join("\n");

  // 元数据注释
  const tagMatch = raw.match(/<!--\s*成本标签[:：]\s*([^>]+?)-->/);
  const tags = tagMatch ? parseTags(tagMatch[1]) : null;
  if (!tagMatch) fail(`${id}: 缺少成本标签注释`);

  // 字段提取（字段值可能跨多行，直到下一个「- 字段：」或注释）
  const fieldRe = /^-\s*(成本|说人话|收益|证据等级|来源|备注)[:：]\s*(.*)$/gm;
  const fields = {};
  const order = [];
  let m;
  const positions = [];
  while ((m = fieldRe.exec(raw))) {
    positions.push({ name: m[1], start: m.index, headEnd: fieldRe.lastIndex, head: m[2] });
  }
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    const next = positions[i + 1];
    // 取头部 + 后续缩进行
    let value = p.head;
    const rest = raw.slice(p.headEnd, next ? next.start : undefined);
    for (const line of rest.split("\n")) {
      if (/^\s{2,}\S/.test(line)) value += "\n" + line.trim();
    }
    fields[p.name] = value.trim();
    order.push(p.name);
  }
  for (const required of ["成本", "说人话", "收益", "证据等级", "来源", "备注"]) {
    if (!fields[required] || !fields[required].trim()) {
      fail(`${id}: 字段「${required}」缺失或为空`);
    }
  }

  // 证据等级：A / A（争议） / B（指南强推荐，但底层证据等级低）
  let evidenceGrade = null;
  let controversial = false;
  let gradeNote = null;
  const gradeRaw = fields["证据等级"] ?? "";
  const gm = gradeRaw.match(/^([ABC])/);
  if (gm) {
    evidenceGrade = gm[1];
    const noteMatch = gradeRaw.match(/^[ABC][（(]([^）)]*)[）)]/);
    if (noteMatch) {
      if (noteMatch[1].includes("争议")) controversial = true;
      gradeNote = noteMatch[1] || null;
    }
  } else {
    fail(`${id}: 证据等级无法解析：${gradeRaw}`);
  }

  const bodyText = ["成本", "说人话", "收益", "备注"]
    .map((k) => fields[k] ?? "")
    .join("\n");
  const crossrefs = parseCrossrefs(bodyText, chapter.number).map((r) => ({
    ...r,
    targetEntryId: null, // 二次填充
  }));

  return {
    id,
    chapterId: chapter.id,
    chapterNumber: chapter.number,
    entryNumber: block.entryNumber,
    globalIndex,
    title: block.title,
    cost: fields["成本"] ?? "",
    plainTalk: fields["说人话"] ?? "",
    benefit: fields["收益"] ?? "",
    evidenceGrade,
    controversial,
    gradeNote,
    tags: tags ?? {},
    note: fields["备注"] ?? "",
    sources: parseSources(fields["来源"] ?? ""),
    crossrefs,
    contentHash: "",
  };
}

// ---------- 主流程 ----------
const bookDir = join(repoPath, "book");
if (!existsSync(bookDir)) {
  console.error(`✗ 未找到上游 book/ 目录：${bookDir}`);
  process.exit(1);
}

const files = readdirSync(bookDir)
  .filter((f) => f.endsWith(".md"))
  .sort(); // 文件名 01-… 34-… 天然有序

const chapters = [];
const entries = [];
let order = 0;
for (const fileName of files) {
  order += 1;
  const content = readFileSync(join(bookDir, fileName), "utf8");
  const parsed = parseChapter(fileName, content, order);
  if (!parsed) continue;
  const { chapter, entryBlocks } = parsed;
  // 章内条号连续性
  entryBlocks.forEach((b, i) => {
    if (b.entryNumber !== i + 1) {
      fail(`${fileName}: 章内条号不连续，第 ${i + 1} 块的条号是 ${b.entryNumber}`);
    }
  });
  chapters.push(chapter);
  for (const block of entryBlocks) {
    entries.push(parseEntry(block, chapter, entries.length + 1));
  }
}

// 章 ID 唯一
const chapterIds = new Set(chapters.map((c) => c.id));
if (chapterIds.size !== chapters.length) fail("存在重复章节 ID");
// 条 ID 唯一
const entryIds = new Set(entries.map((e) => e.id));
if (entryIds.size !== entries.length) fail("存在重复条目 ID");
// 章号连续
chapters.forEach((c, i) => {
  if (c.number !== i + 1) fail(`章节序号不连续：${c.fileName}（${c.number}）`);
});

// 交叉引用目标解析与校验
for (const e of entries) {
  for (const ref of e.crossrefs) {
    const targetId = `ch${String(ref.chapterNumber).padStart(2, "0")}-e${String(ref.entryNumber).padStart(3, "0")}`;
    if (!entryIds.has(targetId)) {
      fail(`${e.id}: 交叉引用目标不存在 → ${ref.raw}（${targetId}）`);
    }
    ref.targetEntryId = targetId;
  }
}

// 来源链接校验：至少 60% 的条目应带外部链接（来源只引原始文献，几乎都有链接）
const withUrl = entries.filter((e) => e.sources.some((s) => s.url)).length;
if (entries.length && withUrl / entries.length < 0.6) {
  fail(`带外部链接的条目占比异常：${withUrl}/${entries.length}`);
}

// 内容哈希
for (const e of entries) {
  e.contentHash = sha256(
    [e.id, e.title, e.cost, e.plainTalk, e.benefit, e.evidenceGrade, e.note, JSON.stringify(e.sources)].join("\n")
  );
}
for (const c of chapters) {
  c.contentHash = sha256(`${c.id}\n${c.title}\n${c.intro}`);
}
const contentHash = sha256(entries.map((e) => e.contentHash).join("\n"));

const gradeStats = { A: 0, B: 0, C: 0 };
const scopeStats = {};
for (const e of entries) {
  gradeStats[e.evidenceGrade] = (gradeStats[e.evidenceGrade] ?? 0) + 1;
  const s = e.tags.scope ?? "未标注";
  scopeStats[s] = (scopeStats[s] ?? 0) + 1;
}

if (errors.length) {
  console.error(`✗ 同步失败，共 ${errors.length} 个错误：`);
  for (const err of errors.slice(0, 30)) console.error(`  - ${err}`);
  if (errors.length > 30) console.error(`  … 另有 ${errors.length - 30} 个错误`);
  process.exit(1);
}

const commitSha = getCommitSha();
const output = {
  version: 1,
  source: {
    repoUrl: REPO_URL,
    commitSha,
    syncedAt: new Date().toISOString(),
  },
  contentHash,
  stats: {
    chapterCount: chapters.length,
    entryCount: entries.length,
    grades: gradeStats,
    scopes: scopeStats,
    controversialCount: entries.filter((e) => e.controversial).length,
    crossrefCount: entries.reduce((n, e) => n + e.crossrefs.length, 0),
    sourceLinkCount: withUrl,
  },
  chapters,
  entries,
};

writeFileSync(outPath, JSON.stringify(output), "utf8");

console.log(`✓ 知识库同步完成`);
console.log(`  仓库：${REPO_URL}`);
console.log(`  Commit：${commitSha}`);
console.log(`  章节：${chapters.length}，条目：${entries.length}`);
console.log(`  证据等级：A ${gradeStats.A} / B ${gradeStats.B} / C ${gradeStats.C}`);
console.log(`  交叉引用：${output.stats.crossrefCount} 条，外部来源链接：${withUrl} 个条目`);
console.log(`  内容哈希：${contentHash.slice(0, 16)}…`);
console.log(`  输出：${outPath}（${(JSON.stringify(output).length / 1024 / 1024).toFixed(2)} MB）`);
if (warnings.length) {
  console.log(`  ⚠ 警告：`);
  warnings.slice(0, 10).forEach((w) => console.log(`    - ${w}`));
}
