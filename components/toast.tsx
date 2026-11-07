"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { IconCheck, IconInfo, IconX } from "./icons";

type Kind = "success" | "error" | "info";
export type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; kind: Kind; title: string; body?: string; action?: ToastAction };
type Notify = (kind: Kind, title: string, body?: string, action?: ToastAction) => void;

const ToastContext = createContext<Notify>(() => {});

export function useToast(): Notify {
  return useContext(ToastContext);
}

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback<Notify>((kind, title, body, action) => {
    const id = nextId++;
    setToasts((t) => [...t.slice(-3), { id, kind, title, body, action }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), action ? 10_000 : kind === "error" ? 7000 : 4200);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span className="ticon">{t.kind === "success" ? <IconCheck /> : t.kind === "error" ? <IconX /> : <IconInfo />}</span>
            <div style={{ minWidth: 0 }}>
              <b>{t.title}</b>
              {t.body && <span className="muted">{t.body}</span>}
            </div>
            {t.action && (
              <button
                className="btn btn-sm toast-action"
                onClick={() => {
                  setToasts((all) => all.filter((x) => x.id !== t.id));
                  t.action!.onClick();
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
