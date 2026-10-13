import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { sb, run } from './supabase';

export type Me = { id: string; nome: string; email: string; role: 'admin' | 'colaborador'; ativo: boolean; unidade?: string | null };
export type Cfg = { nota_aprovacao: number; nota_reforco: number; unidades: string[] };

type Ctx = { me: Me | null; cfg: Cfg; reloadMe: () => Promise<void>; reloadCfg: () => Promise<void>; toast: (m: string, err?: boolean) => void; unread: number; refreshUnread: () => void };
const C = createContext<Ctx>(null as any);
export const useApp = () => useContext(C);

export function useHash() {
  const [h, setH] = useState(location.hash || '#/');
  useEffect(() => { const f = () => { setH(location.hash || '#/'); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return h.replace(/^#/, '') || '/';
}
export const go = (p: string) => { location.hash = '#' + p; };

export function AppProvider({ me, children, reloadMe }: { me: Me | null; children: React.ReactNode; reloadMe: () => Promise<void> }) {
  const [cfg, setCfg] = useState<Cfg>({ nota_aprovacao: 85, nota_reforco: 70, unidades: [] });
  const [msg, setMsg] = useState<{ m: string; err?: boolean } | null>(null);
  const [unread, setUnread] = useState(0);
  const toast = useCallback((m: string, err?: boolean) => { setMsg({ m, err }); setTimeout(() => setMsg(null), 3800); }, []);
  const reloadCfg = useCallback(async () => {
    const { data } = await sb.from('configuracoes').select('*').maybeSingle();
    if (data) setCfg({ nota_aprovacao: data.nota_aprovacao ?? 85, nota_reforco: data.nota_reforco ?? 70, unidades: data.unidades || [] });
  }, []);
  const refreshUnread = useCallback(async () => {
    if (!me) return;
    const { count } = await sb.from('notificacoes').select('id', { count: 'exact', head: true }).eq('user_id', me.id).eq('lida', false);
    setUnread(count || 0);
  }, [me?.id]);
  useEffect(() => { if (me?.ativo) { reloadCfg(); refreshUnread(); } }, [me?.id, me?.ativo]);
  useEffect(() => {
    if (!me?.ativo) return;
    const ch = sb.channel('notif-' + me.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `user_id=eq.${me.id}` }, (p: any) => {
      toast(p.new.titulo + (p.new.corpo ? ' — ' + p.new.corpo : '')); refreshUnread();
    }).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [me?.id, me?.ativo]);
  return (
    <C.Provider value={{ me, cfg, reloadMe, reloadCfg, toast, unread, refreshUnread }}>
      {children}
      {msg && <div role="status" className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] max-w-[92vw] px-4 py-2.5 rounded-lg text-sm shadow-lg no-print ${msg.err ? 'bg-red-700 text-white' : 'bg-stone-900 text-amber-100'}`}>{msg.m}</div>}
    </C.Provider>
  );
}

/** Carrega dados assíncronos com estado de loading/erro */
export function useAsync<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true; setLoading(true);
    fn().then((d) => { if (alive) { setData(d); setErr(null); } }).catch((e) => { if (alive) setErr(e.message); }).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [...deps, tick]);
  return { data, err, loading, reload: () => setTick((t) => t + 1), setData };
}
export { run };
