"use client";
import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

type ToastType = "success" | "error";
type Toast = { id: number; message: string; type: ToastType };
interface ToastCtxType { show: (msg: string, type?: ToastType) => void; addToast: (msg: string, type?: ToastType) => void; }
const ToastCtx = createContext<ToastCtxType>({ show: () => {}, addToast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, type: ToastType = "success") => {
    const id = Date.now();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  const remove = (id: number) => setToasts(t => t.filter(x => x.id !== id));
  return (
    <ToastCtx.Provider value={{ show, addToast: show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 min-w-72">
        {toasts.map(t => (
          <div key={t.id} className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${t.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
            {t.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)}><X size={14} /></button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
