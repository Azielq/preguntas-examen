import { create } from 'zustand';

export interface ToastItem {
  id: number;
  text: string;
  tone: 'info' | 'warning' | 'success';
  persistent: boolean;
  action?: { label: string; href: string };
}

interface ToastStore {
  toasts: ToastItem[];
  push(text: string, opts?: Partial<Omit<ToastItem, 'id' | 'text'>>): number;
  dismiss(id: number): void;
}

let seq = 1;

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push(text, opts = {}) {
    // no repetir el mismo aviso persistente
    const dup = get().toasts.find((t) => t.text === text);
    if (dup) return dup.id;
    const id = seq++;
    const t: ToastItem = { id, text, tone: opts.tone ?? 'info', persistent: opts.persistent ?? false, action: opts.action };
    set((s) => ({ toasts: [...s.toasts, t] }));
    if (!t.persistent) setTimeout(() => get().dismiss(id), 4000);
    return id;
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = (text: string, opts?: Partial<Omit<ToastItem, 'id' | 'text'>>) => useToasts.getState().push(text, opts);
