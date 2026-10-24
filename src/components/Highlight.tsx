import { type ReactNode } from "react";

/** 搜索关键词高亮：将文本按关键词切分并加 <mark> 样式 */
export function Highlight({ text, keyword }: { text: string; keyword: string }) {
  const kw = keyword.trim();
  if (!kw) return <>{text}</>;
  const lower = text.toLowerCase();
  const kwLower = kw.toLowerCase();
  const parts: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const idx = lower.indexOf(kwLower, i);
    if (idx < 0) {
      parts.push(text.slice(i));
      break;
    }
    if (idx > i) parts.push(text.slice(i, idx));
    parts.push(
      <mark key={key++} className="hl">
        {text.slice(idx, idx + kw.length)}
      </mark>
    );
    i = idx + kw.length;
  }
  return <>{parts}</>;
}
