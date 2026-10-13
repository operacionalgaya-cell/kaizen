import React, { useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';

export function Loading({ text = 'Carregando…' }: { text?: string }) {
  return <div className="flex items-center justify-center gap-2 py-16 text-stone-500 text-sm"><Loader2 className="w-4 h-4 animate-spin" />{text}</div>;
}
export function ErrorBox({ msg }: { msg: string }) {
  return <div className="m-4 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">Algo deu errado: {msg}</div>;
}
export function Page({ title, subtitle, actions, children, wide }: { title?: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`${wide ? 'max-w-7xl' : 'max-w-5xl'} mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            {title && <h1 className="text-3xl sm:text-4xl font-medium text-stone-900">{title}</h1>}
            {subtitle && <p className="text-sm text-stone-500 mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', f); return () => removeEventListener('keydown', f); }, []);
  return (
    <div className="fixed inset-0 z-[80] bg-stone-900/60 flex items-start sm:items-center justify-center p-3 overflow-y-auto no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`bg-white rounded-xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} my-6`}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200">
          <h2 className="text-2xl font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="p-1 text-stone-500 hover:text-stone-900"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
export function Bar({ p, className = '' }: { p: number; className?: string }) {
  const c = p < 70 ? 'bg-red-500' : p < 85 ? 'bg-amber-500' : 'bg-emerald-600';
  return <div className={`h-2 rounded-full bg-stone-100 overflow-hidden ${className}`}><div className={`h-full ${c}`} style={{ width: `${Math.min(100, p)}%` }} /></div>;
}
export function Kpi({ v, l, hint }: { v: React.ReactNode; l: string; hint?: string }) {
  return <div className="card !p-4"><div className="text-3xl font-serif-display font-semibold text-amber-900 tabular-nums">{v}</div><div className="text-xs text-stone-500 mt-0.5">{l}</div>{hint && <div className="text-[11px] text-stone-400 mt-1">{hint}</div>}</div>;
}
export function Empty({ text }: { text: string }) { return <div className="card text-center text-sm text-stone-500 py-10">{text}</div>; }
export function Status({ s }: { s: string }) {
  const m: any = { em_andamento: ['warn', 'em andamento'], enviada: ['warn', 'aguardando correção'], corrigida: ['ok', 'corrigida'], rascunho: ['', 'rascunho'], publicada: ['ok', 'publicada'], encerrada: ['', 'encerrada'] };
  const [k, t] = m[s] || ['', s];
  return <span className={`pill ${k ? 'pill-' + k : ''}`}>{t}</span>;
}
export const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (<div><label className="lbl">{label}</label>{children}</div>);
