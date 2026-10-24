import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[1px]" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto",
            "rounded border border-line bg-card shadow-pop",
            wide ? "max-w-2xl" : "max-w-lg"
          )}
        >
          <div className="sticky top-0 flex items-start justify-between border-b border-line bg-card px-5 py-4">
            <div>
              <DialogPrimitive.Title className="font-serif text-base font-semibold">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="mt-0.5 text-xs text-ink-faint">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogPrimitive.Close
              aria-label="关闭"
              className="rounded p-1 text-ink-faint hover:bg-paper hover:text-ink"
            >
              <X size={16} />
            </DialogPrimitive.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** 二次确认对话框（破坏性操作必须使用） */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "确认执行",
  danger,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
  /** 额外的风险提示内容 */
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {children}
      <div className="mt-5 flex justify-end gap-2">
        <DialogPrimitive.Close asChild>
          <button className="rounded border border-line bg-white px-3.5 py-1.5 text-sm text-ink-soft hover:border-ink-faint hover:text-ink">
            取消
          </button>
        </DialogPrimitive.Close>
        <button
          onClick={() => void onConfirm()}
          className={cn(
            "rounded border px-3.5 py-1.5 text-sm font-medium text-white transition-colors",
            danger ? "border-transparent bg-danger hover:bg-danger/85" : "border-transparent bg-vermilion hover:bg-vermilion-deep"
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}
