"use client";
import { useStore } from "@/store/globalStore";

export function Toast() {
  const { toastError } = useStore();
  if (!toastError) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-red-950/90 border border-red-500/50 text-red-100 text-sm px-5 py-3 rounded-xl shadow-2xl z-50 max-w-sm text-center animate-bounce">
      ⚠️ {toastError}
    </div>
  );
}
export default Toast;
