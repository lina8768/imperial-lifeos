import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Upload, ShieldCheck, BookMarked, AlertTriangle, ScrollText } from "lucide-react";
import { PageHeader, Button, Badge, Input, Select } from "@/components/ui";
import { ConfirmDialog } from "@/components/Dialog";
import { exportAll, downloadBackup, parseBackup, restoreBackup, type ImportPreview } from "@/storage/repositories/backupService";
import { getBookVersion } from "@/storage/bookSeed";
import { getSetting, setSetting } from "@/storage/repositories/settingsRepo";
import { getSchemaVersion } from "@/storage/migrations";
import type { BookVersion } from "@/storage/db";

const COUNT_LABELS: Record<string, string> = {
  tasks: "任务",
  taskLogs: "任务记录",
  metrics: "指标",
  metricRecords: "指标记录",
  journals: "日志",
  reviews: "复盘",
  reviewActions: "复盘行动",
  entryFavorites: "收藏",
  appSettings: "设置项",
};

export default function SettingsPage() {
  const [version, setVersion] = useState<BookVersion | undefined>();
  const [schemaVersion, setSchemaVersion] = useState(0);
  const [taskPageSize, setTaskPageSize] = useState(50);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [importError, setImportError] = useState("");
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restored, setRestored] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      setVersion(await getBookVersion());
      setSchemaVersion(await getSchemaVersion());
      setTaskPageSize(await getSetting<number>("taskPageSize", 50));
    })();
  }, []);

  async function onExport() {
    const backup = await exportAll();
    downloadBackup(backup);
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    setImportError("");
    setRestored(false);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setPreview(await parseBackup(text));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
      setPreview(null);
    } finally {
      e.target.value = "";
    }
  }

  async function doRestore() {
    if (!preview) return;
    await restoreBackup(preview.backup);
    setConfirmRestore(false);
    setPreview(null);
    setRestored(true);
  }

  return (
    <div>
      <PageHeader title="内务府" subtitle="备份、恢复与典籍档案" />

      <div className="space-y-6">
        {/* 内政纲领 */}
        <section className="panel p-5">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-base font-semibold">
            <ScrollText size={16} className="text-teal" /> 内政纲领
          </h2>
          <p className="mb-4 text-xs leading-relaxed text-ink-soft">
            你在引导时勾选的周期事项，会自动生成每日 / 每周 / 每年待办。随时可重选：增加新事项、取消不再坚持的。
          </p>
          <Link to="/onboarding">
            <Button variant="secondary">重选内政纲领</Button>
          </Link>
        </section>

        {/* 备份与恢复 */}
        <section className="panel p-5">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-base font-semibold">
            <ShieldCheck size={16} className="text-jade" /> 备份与恢复
          </h2>
          <p className="mb-4 text-xs leading-relaxed text-ink-soft">
            所有数据仅存于本机浏览器（IndexedDB）。定期导出 JSON 备份，换机或清缓存前务必导出。
            导入会<strong className="text-danger">整体替换</strong>当前全部个人数据。
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void onExport()}>
              <Download size={14} /> 导出备份 JSON
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> 导入恢复
            </Button>
            <input ref={fileRef} type="file" accept=".json,.lifeos.json,application/json" className="hidden" onChange={(e) => void onFileChosen(e)} aria-label="选择备份文件" />
          </div>

          {importError && (
            <div className="mt-4 rounded border border-danger/30 bg-danger/5 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
                <AlertTriangle size={13} /> 备份校验失败
              </p>
              <p className="mt-1 text-xs text-danger/80">{importError}</p>
            </div>
          )}

          {restored && (
            <div className="mt-4 rounded border border-jade/30 bg-jade-soft/50 p-3 text-xs text-jade-deep">
              ✓ 恢复完成，数据已整体替换。刷新页面以查看全部更新。
            </div>
          )}

          {/* 导入预览 */}
          {preview && (
            <div className="mt-4 rounded border border-line bg-paper p-4">
              <p className="mb-3 text-xs font-medium text-ink">备份内容预览</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-ink-faint">
                    <th className="py-1 font-normal">数据</th>
                    <th className="py-1 font-normal">当前</th>
                    <th className="py-1 font-normal">备份中</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(COUNT_LABELS).map((key) => (
                    <tr key={key} className="border-t border-line/60">
                      <td className="py-1.5">{COUNT_LABELS[key]}</td>
                      <td className="py-1.5">{preview.currentCounts[key] ?? 0}</td>
                      <td className="py-1.5 font-medium">{preview.counts[key] ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.bookMismatch && (
                <p className="mt-3 rounded bg-gold-soft p-2 text-[11px] text-gold">
                  注意：备份的知识库版本与当前内置版本不同（正文内容可能已更新），个人数据不受影响。
                </p>
              )}
              <div className="mt-4 flex items-center justify-between">
                <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
                  取消
                </Button>
                <Button size="sm" variant="danger" onClick={() => setConfirmRestore(true)}>
                  覆盖恢复当前数据
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* 知识库来源 */}
        <section className="panel p-5">
          <h2 className="mb-3 flex items-center gap-2 font-serif text-base font-semibold">
            <BookMarked size={16} className="text-gold" /> 知识库来源与版本
          </h2>
          {version ? (
            <dl className="grid grid-cols-1 gap-x-8 gap-y-2 text-xs sm:grid-cols-2">
              <Item term="原作品" desc="《高性价比人生指南》" />
              <Item term="原作者" desc="eternity4719" />
              <Item
                term="原仓库"
                desc={
                  <a className="text-vermilion hover:underline" href={version.repoUrl} target="_blank" rel="noreferrer">
                    {version.repoUrl.replace("https://", "")}
                  </a>
                }
              />
              <Item term="正文许可" desc={<a className="text-vermilion hover:underline" href="https://creativecommons.org/licenses/by/4.0/deed.zh" target="_blank" rel="noreferrer">CC BY 4.0（署名 4.0 国际）</a>} />
              <Item term="内容版本 commit" desc={version.commitSha.slice(0, 16)} />
              <Item term="同步日期" desc={version.syncedAt.slice(0, 10)} />
              <Item term="内容哈希" desc={version.contentHash.slice(0, 24) + "…"} />
              <Item term="章节 / 条目" desc={`${version.chapterCount} 章 · ${version.entryCount} 条`} />
              <Item term="证据等级分布" desc={`A ${version.stats.grades.A ?? 0} · B ${version.stats.grades.B ?? 0} · C ${version.stats.grades.C ?? 0}`} />
              <Item term="数据结构版本" desc={`v${schemaVersion}`} />
            </dl>
          ) : (
            <p className="text-xs text-ink-faint">加载中……</p>
          )}
          <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-ink-faint">
            本项目为独立衍生应用，与原作者无关联、不代表官方产品。原书正文（含本应用内展示的全部条目文字）
            版权归原作者所有，依 CC BY 4.0 引用；应用代码另以 MIT 许可发布，详见 LICENSE 与 LICENSE-CONTENT。
            正文仅做显示层排版，未做任何改写。
          </p>
        </section>

        {/* 基础设置 */}
        <section className="panel p-5">
          <h2 className="mb-3 font-serif text-base font-semibold">基础设置</h2>
          <div className="flex max-w-xs items-end gap-3">
            <div>
              <label className="label" htmlFor="page-size">任务列表每页显示</label>
              <Select
                id="page-size"
                value={String(taskPageSize)}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setTaskPageSize(v);
                  void setSetting("taskPageSize", v);
                }}
                className="w-28"
              >
                {[20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n} 条</option>
                ))}
              </Select>
            </div>
          </div>
        </section>

        {/* 关于 */}
        <section className="panel p-5">
          <h2 className="mb-3 font-serif text-base font-semibold">关于</h2>
          <p className="text-xs leading-relaxed text-ink-soft">
            御前内政 Imperial LifeOS v0.1.0 —— 个人生活管理系统，数据完全本地化，无账号、无后端、无追踪。
            感谢开源社区与《高性价比人生指南》作者 eternity4719。
          </p>
        </section>
      </div>

      <ConfirmDialog
        open={confirmRestore}
        onOpenChange={(o) => !o && setConfirmRestore(false)}
        title="确认覆盖恢复？"
        description="当前全部个人数据（任务、指标、日志、复盘、收藏、设置）将被备份内容整体替换。"
        confirmLabel="我已了解，覆盖恢复"
        danger
        onConfirm={doRestore}
      >
        <p className="rounded bg-danger/5 p-3 text-xs leading-relaxed text-danger">
          ⚠️ 此操作不可撤销。替换前建议先导出一份当前数据作为备份。
        </p>
      </ConfirmDialog>
    </div>
  );
}

function Item({ term, desc }: { term: string; desc: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/50 py-1.5">
      <dt className="shrink-0 text-ink-faint">{term}</dt>
      <dd className="break-all text-right text-ink">{desc}</dd>
    </div>
  );
}

export { Badge, Input };
