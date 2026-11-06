import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from 'lucide-react';
import { cn } from './format';

type Tone = 'success' | 'error' | 'info' | 'warning';
interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: Tone;
}

const Ctx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = (id: number) => setToasts((ts) => ts.filter((t) => t.id !== id));
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = ++seq;
    setToasts((ts) => [...ts.slice(-3), { ...t, id }]);
    setTimeout(() => dismiss(id), 4500);
  }, []);

  const icon = { success: CheckCircle2, error: XCircle, info: Info, warning: TriangleAlert };
  const color = { success: 'text-success', error: 'text-danger', info: 'text-info', warning: 'text-warning' };

  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = icon[t.tone];
          return (
            <div key={t.id} role="status" className="pointer-events-auto flex animate-pop-in items-start gap-3 rounded-lg border border-border bg-surface p-3 shadow-overlay">
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', color[t.tone])} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{t.title}</p>
                {t.body && <p className="mt-0.5 text-xs text-muted">{t.body}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="rounded p-0.5 text-subtle hover:bg-surface-2 hover:text-fg" aria-label="Dismiss">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
