"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { IconCheck, IconInfo, IconX } from "./icons";

type Kind = "success" | "error" | "info";
type Toast = { id: number; kind: Kind; title: string; body?: string };
type Notify = (kind: Kind, title: string, body?: string) => void;

const ToastContext = createContext<Notify>(() => {});

export function useToast(): Notify {
  return useContext(ToastContext);
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback<Notify>((kind, title, body) => {
    const id = nextId++;
    setToasts((t) => [...t.slice(-3), { id, kind, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 7000 : 4200);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span className="ticon">{t.kind === "success" ? <IconCheck /> : t.kind === "error" ? <IconX /> : <IconInfo />}</span>
            <div>
              <b>{t.title}</b>
              {t.body && <span className="muted">{t.body}</span>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
