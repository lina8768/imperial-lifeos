/**
 * 周期性可执行条目提取器
 *
 * 从 767 条《高性价比人生指南》里，智能提取"周期性、可日常执行"的条目，
 * 标注频率（daily/weekly/monthly/yearly）、节点（什么时间点做）、优先级，
 * 排除否定类（"别/不要"）和一次性决策类（买房/离婚/开户）条目。
 *
 * 输出 src/data/recurring-catalog.json，供引导页展示与自动任务生成器消费。
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const BOOK_PATH = resolve(ROOT, "src/data/book-data.json");
const VERSION_PATH = resolve(ROOT, "src/data/book-version.json");
const OUT_PATH = resolve(ROOT, "src/data/recurring-catalog.json");

const book = JSON.parse(readFileSync(BOOK_PATH, "utf8"));
const version = book.source;

// ===== 频率识别规则（按优先级，先匹配更具体的） =====
const FREQ_RULES = [
  // daily：每日高频
  { freq: "daily", re: /每天|每日|日常|晨起|睡前|餐前|餐后|每天都|每天走到|每天都喝|每天吃|每天喝|每天清|每天多|每天固定|每天遛/ },
  // weekly：每周
  { freq: "weekly", re: /每周|每\s*[1-9]\s*周|周累计|每周周|每半周/ },
  // monthly：每月
  { freq: "monthly", re: /每月|每\s*[1-9]\s*个月|月度|每月月/ },
  // yearly：每年/半年/季度/每N年
  { freq: "yearly", re: /每年|年度|每半年|半年复查|每\s*[1-9]\s*年|每\s*[二三四五六七八十]\s*年|每\s*2\s*到\s*[0-9]\s*年|季度|每季度/ },
];

// ===== 否定排除（"别/不要/禁止"开头或核心是否定句） =====
const NEGATIVE_RE = /^(别|不要|禁止|切勿|别把|别拿|别去|别先|别为了|别自己|别连着|别吃|别喝|别把|别拿钱|别在家里|别为了凑|不要为了|不要把|不要自行|不要长期|不要熬夜|不要久坐)/;
// 否定动作出现在标题任意位置也排除（"别自己硬戒""别拿每年"等）
const NEGATIVE_ANY_RE = /别自己硬戒|别去境外|别先给|别拿每年|别自行停|别自行戒|别为了长寿专门/;

// ===== 一次性决策排除（无明确周期词时排除） =====
const ONEOFF_RE = /离婚|买房|卖房|开户|买定期寿险|想买美股|开公司|当个体户|养狗|养宠物|结婚|生孩子|要孩子|出国|移民|辞职|创业|投资.*股|买基金|卖肾|卖血|捐肾|被家暴|报警|申请人身|过户|登记|继承|遗嘱/;

// ===== 科普/金额排除：标题含金额、政策、权益科普词的排除（"每年 X 元/%" 不是任务） =====
const KNOWLEDGE_RE = /\d+元|\d+%|英镑|镑|津贴|补贴|补助|抚恤金|退役金|产假|陪产假|育儿假|基准线|算一遍|打工.*选项|读不起|当兵|工亡|抚养费|定向考录|签证费|附加费|每月被罚|每年发作|每年补最高|每孩每年|每年扣减|每年 776|每年 10%|别拿每年/;

// ===== 节点识别 =====
function detectNode(text, freq) {
  if (freq === "daily") {
    if (/晨起|早晨|早上|起床后/.test(text)) return "morning";
    if (/睡前|晚上|夜间|临睡/.test(text)) return "evening";
    if (/餐前|饭前|吃.*前/.test(text)) return "before-meal";
    if (/餐后|饭后|吃.*后/.test(text)) return "after-meal";
    return "anytime";
  }
  if (freq === "weekly") {
    if (/周一|周二|周三|周四|周五/.test(text)) {
      const m = text.match(/周([一二三四五])/);
      return m ? `weekday-${m[1]}` : "anytime";
    }
    if (/周末|周六|周日/.test(text)) return "weekend";
    return "anytime";
  }
  if (freq === "monthly") {
    if (/月初|每月初/.test(text)) return "month-start";
    if (/月底|每月底|月末/.test(text)) return "month-end";
    return "anytime";
  }
  if (freq === "yearly") {
    // 提取月份 → 季度
    const months = text.match(/[1-9][0-2]?月|一月|二月|三月|四月|五月|六月|七月|八月|九月|十月|十一月|十二月/g);
    if (months) {
      const nums = months.map(m => {
        const map = { "一月": 1, "二月": 2, "三月": 3, "四月": 4, "五月": 5, "六月": 6, "七月": 7, "八月": 8, "九月": 9, "十月": 10, "十一月": 11, "十二月": 12 };
        for (const [k, v] of Object.entries(map)) if (m.includes(k)) return v;
        return parseInt(m);
      }).filter(n => n >= 1 && n <= 12);
      if (nums.length) {
        const min = Math.min(...nums), max = Math.max(...nums);
        if (min <= 3 && max <= 3) return "year-q1";
        if (min >= 4 && max <= 6) return "year-q2";
        if (min >= 7 && max <= 9) return "year-q3";
        if (min >= 10) return "year-q4";
        if (min <= 6 && max >= 4) return "year-h1";
        return `year-m${nums[0]}`;
      }
    }
    if (/年初|1月1日/.test(text)) return "year-start";
    if (/年底|年末|12月31日/.test(text)) return "year-end";
    return "year-anytime";
  }
  return "anytime";
}

// ===== 优先级计算：证据 × 收益 ÷ (1 + 成本) =====
function calcPriority(entry) {
  const gradeScore = { A: 3, B: 2, C: 1 }[entry.evidenceGrade] ?? 1;
  const benefit = entry.tags?.benefit ?? 1; // 1小 2中 3大
  const money = entry.tags?.money ?? 0;     // 0-3
  const time = entry.tags?.time ?? 0;        // 0-3
  const will = entry.tags?.willpower ?? 0;   // 0-3
  const costPenalty = 1 + (money + time + will) * 0.35;
  const score = (gradeScore * benefit) / costPenalty;
  if (score >= 1.4) return { score: Math.round(score * 100) / 100, level: "high" };
  if (score >= 0.75) return { score: Math.round(score * 100) / 100, level: "medium" };
  return { score: Math.round(score * 100) / 100, level: "low" };
}

// ===== 口径（scope）中文映射 =====
const SCOPE_MAP = { 1: "健康寿命", 2: "财富管理", 3: "时间效率", 4: "人身自由", 5: "日常其他" };

// ===== actionLabel：从标题提炼核心动作 =====
const FREQ_WORDS_RE = /每天|每日|日常|晨起|睡前|餐前|餐后|每周|每月|每年|年度|每半年|半年|季度|每\s*[0-9]+\s*[周年个月]|每\s*[二三四五六七八九十]+\s*[周年]/g;
function extractActionLabel(title) {
  let t = title.replace(FREQ_WORDS_RE, "");
  t = t.replace(/^[，,。、：:；;\s]+|^[。]/g, "");
  t = t.replace(/^[1-9][0-9]?\.?\s*/, "");
  t = t.trim();
  if (t.length < 4) return title.replace(/^###\s*[0-9]+\.?\s*/, "").trim();
  return t.length > 40 ? t.slice(0, 40) + "…" : t;
}

// ===== 主流程 =====
const items = [];
const rejected = { negative: 0, oneoff: 0, noFreq: 0 };

for (const entry of book.entries) {
  // 清洗标题：去掉 "### N." 前缀
  const title = entry.title.replace(/^###\s*/, "").replace(/^\d+\.\s*/, "").trim();
  // 全文（用于节点识别和上下文）
  const fullText = `${title} ${entry.plainTalk || ""} ${entry.cost || ""}`;

  // 1. 否定排除
  if (NEGATIVE_RE.test(title) || NEGATIVE_ANY_RE.test(title)) {
    rejected.negative++;
    continue;
  }

  // 1b. 科普/金额排除
  if (KNOWLEDGE_RE.test(title)) {
    rejected.oneoff++;
    continue;
  }

  // 2. 频率识别 —— 只看标题，避免正文提到"每天/每年"的一次性知识被误判
  let freq = null;
  for (const rule of FREQ_RULES) {
    if (rule.re.test(title)) { freq = rule.freq; break; }
  }
  if (!freq) {
    rejected.noFreq++;
    continue;
  }

  // 3. 一次性决策排除（标题含决策词且无明确周期词的排除）
  if (ONEOFF_RE.test(title) && !FREQ_RULES.some(r => r.re.test(title))) {
    rejected.oneoff++;
    continue;
  }

  const node = detectNode(fullText, freq);
  const pri = calcPriority(entry);
  const scope = SCOPE_MAP[entry.tags?.scope] ?? "日常其他";

  items.push({
    entryId: entry.id,
    chapterNumber: entry.chapterNumber,
    entryNumber: entry.entryNumber,
    title,
    plainTalk: (entry.plainTalk || "").slice(0, 220),
    frequency: freq,
    node,
    priority: pri.level,
    priorityScore: pri.score,
    evidenceGrade: entry.evidenceGrade,
    scope,
    costTags: {
      money: entry.tags?.money ?? 0,
      time: entry.tags?.time ?? 0,
      willpower: entry.tags?.willpower ?? 0,
      benefit: entry.tags?.benefit ?? 1,
    },
    actionLabel: extractActionLabel(title),
  });
}

// 按优先级得分降序，同分按章节顺序
items.sort((a, b) => b.priorityScore - a.priorityScore || a.chapterNumber - b.chapterNumber || a.entryNumber - b.entryNumber);

const catalog = {
  sourceCommit: version.commitSha,
  sourceRepo: "eternity4719/HowToLiveBetter",
  sourceSyncedAt: version.syncedAt,
  extractedAt: new Date().toISOString(),
  total: items.length,
  byFrequency: {
    daily: items.filter(i => i.frequency === "daily").length,
    weekly: items.filter(i => i.frequency === "weekly").length,
    monthly: items.filter(i => i.frequency === "monthly").length,
    yearly: items.filter(i => i.frequency === "yearly").length,
  },
  byPriority: {
    high: items.filter(i => i.priority === "high").length,
    medium: items.filter(i => i.priority === "medium").length,
    low: items.filter(i => i.priority === "low").length,
  },
  rejected,
  items,
};

mkdirSync(dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, JSON.stringify(catalog, null, 2), "utf8");

// ===== 报告 =====
console.log("===== 周期性条目提取报告 =====");
console.log(`上游 commit: ${version.commitSha}`);
console.log(`总条目数: ${book.entries.length}`);
console.log(`提取周期性条目: ${items.length}`);
console.log(`  按频率: 每日 ${catalog.byFrequency.daily} · 每周 ${catalog.byFrequency.weekly} · 每月 ${catalog.byFrequency.monthly} · 每年 ${catalog.byFrequency.yearly}`);
console.log(`  按优先级: 高 ${catalog.byPriority.high} · 中 ${catalog.byPriority.medium} · 低 ${catalog.byPriority.low}`);
console.log(`排除: 否定句 ${rejected.negative} · 一次性决策 ${rejected.oneoff} · 无频率词 ${rejected.noFreq}`);
console.log(`\n输出: ${OUT_PATH}`);

console.log("\n===== 每日 Top 12 =====");
items.filter(i => i.frequency === "daily").slice(0, 12).forEach((i, n) => {
  console.log(`  ${n + 1}. [${i.evidenceGrade}|${i.priority}] ${i.actionLabel} (节点:${i.node})`);
});
console.log("\n===== 每周 Top 8 =====");
items.filter(i => i.frequency === "weekly").slice(0, 8).forEach((i, n) => {
  console.log(`  ${n + 1}. [${i.evidenceGrade}|${i.priority}] ${i.actionLabel} (节点:${i.node})`);
});
console.log("\n===== 每月 Top 6 =====");
items.filter(i => i.frequency === "monthly").slice(0, 6).forEach((i, n) => {
  console.log(`  ${n + 1}. [${i.evidenceGrade}|${i.priority}] ${i.actionLabel} (节点:${i.node})`);
});
console.log("\n===== 每年 Top 10 =====");
items.filter(i => i.frequency === "yearly").slice(0, 10).forEach((i, n) => {
  console.log(`  ${n + 1}. [${i.evidenceGrade}|${i.priority}] ${i.actionLabel} (节点:${i.node})`);
});
