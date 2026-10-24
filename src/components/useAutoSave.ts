import { useEffect, useRef, useState } from "react";

/**
 * 自动保存 Hook：值变化后延迟 ms 再触发保存（防抖）。
 * 返回保存状态：idle / pending / saving / saved / error。
 */
export function useAutoSave(
  value: string,
  save: (v: string) => Promise<void> | void,
  { delay = 800, enabled = true }: { delay?: number; enabled?: boolean } = {}
) {
  const [state, setState] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const saveRef = useRef(save);
  saveRef.current = save;
  const initialRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    if (value === initialRef.current) return;
    dirtyRef.current = true;
    setState("pending");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setState("saving");
      try {
        await saveRef.current(value);
        initialRef.current = value;
        dirtyRef.current = false;
        setState("saved");
      } catch (err) {
        console.error("自动保存失败", err);
        setState("error");
      }
    }, delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [value, delay, enabled]);

  return { state, isDirty: () => dirtyRef.current };
}
