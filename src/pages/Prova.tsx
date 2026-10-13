import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { sb } from '../lib/supabase';
import { useApp, go } from '../lib/app';
import { Loading, ErrorBox, Page } from '../lib/ui';
import { letter, num } from '../lib/util';

export function Prova({ id }: { id: string }) {
  const { toast } = useApp();
  const [prova, setProva] = useState<any>(null);
  const [err, setErr] = useState('');
  const [ans, setAns] = useState<Record<string, string>>({});
  const [left, setLeft] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const key = 'kaizen_rasc_' + id;
  const sent = useRef(false);

  useEffect(() => {
    sb.rpc('obter_prova', { p_tentativa: id }).then(({ data, error }) => {
      if (error) { go('/resultado/' + id); return; }
      setProva(data);
      try { setAns(JSON.parse(localStorage.getItem(key) || '{}')); } catch { /* ignore */ }
    });
  }, [id]);
  const setA = (qid: string, v: string) => setAns((a) => { const n = { ...a, [qid]: v }; try { localStorage.setItem(key, JSON.stringify(n)); } catch { /* ignore */ } return n; });

  const enviar = async (auto = false) => {
    if (sent.current) return;
    if (!auto) {
      const vazias = prova.itens.filter((q: any) => !(ans[q.id] || '').trim()).length;
      if (!confirm(vazias ? `Você deixou ${vazias} questão(ões) em branco. Enviar mesmo assim?` : 'Enviar a avaliação? Não será possível alterar depois.')) return;
    }
    sent.current = true; setBusy(true);
    const { error } = await sb.rpc('enviar_tentativa', { p_tentativa: id, p_respostas: ans });
    if (error) { sent.current = false; setBusy(false); return toast(error.message, true); }
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    toast('Avaliação enviada!'); go('/resultado/' + id);
  };

  const ansRef = useRef(ans); ansRef.current = ans;
  useEffect(() => {
    if (!prova?.tempo_limite_min) return;
    const end = new Date(prova.iniciada_em).getTime() + prova.tempo_limite_min * 60000;
    const t = setInterval(() => {
      const l = end - Date.now(); setLeft(Math.max(0, l));
      if (l <= 0) { clearInterval(t); toast('Tempo esgotado — enviando suas respostas'); (async () => {
        if (sent.current) return; sent.current = true;
        const { error } = await sb.rpc('enviar_tentativa', { p_tentativa: id, p_respostas: ansRef.current });
        if (error) { sent.current = false; toast(error.message, true); } else go('/resultado/' + id);
      })(); }
    }, 1000);
    return () => clearInterval(t);
  }, [prova]);

  const total = useMemo(() => (prova ? prova.itens.reduce((s: number, q: any) => s + Number(q.pontos), 0) : 0), [prova]);
  if (err) return <ErrorBox msg={err} />;
  if (!prova) return <Loading />;
  const answered = prova.itens.filter((q: any) => (ans[q.id] || '').trim()).length;
  const mm = left != null ? `${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}` : '';

  return (
    <Page title={prova.titulo} subtitle={`${prova.itens.length} questões · ${num(total)} pontos${prova.descricao ? ' · ' + prova.descricao : ''}`}
      actions={left != null ? <span className={`inline-flex items-center gap-1.5 font-mono text-sm px-3 py-1 rounded-full ${left < 300000 ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}><Clock className="w-4 h-4" />{mm}</span> : undefined}>
      <div className="sticky top-16 z-30 -mx-1 px-1 py-2 bg-stone-50/95 backdrop-blur no-print">
        <div className="flex items-center gap-3 text-xs text-stone-600"><span className="font-mono">{answered}/{prova.itens.length}</span>
          <div className="flex-1 h-1.5 rounded-full bg-stone-200 overflow-hidden"><div className="h-full bg-amber-600" style={{ width: `${(answered / prova.itens.length) * 100}%` }} /></div></div>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); enviar(); }} className="space-y-4">
        {prova.itens.map((q: any, i: number) => (
          <div key={q.id} className="card space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-stone-500 font-semibold">{i + 1}. {q.tema} · {num(q.pontos)} pt</div>
            <p className="font-semibold text-stone-900 leading-snug">{q.enunciado}</p>
            {q.tipo === 'aberta' ? (
              <textarea className="inp min-h-32" placeholder="Escreva sua resposta com suas palavras…" value={ans[q.id] || ''} onChange={(e) => setA(q.id, e.target.value)} />
            ) : (
              <div className="space-y-2">{(q.tipo === 'vf' ? [['V', 'Verdadeiro'], ['F', 'Falso']] : (q.opcoes || []).map((t: string, k: number) => [letter(k), t])).map(([v, t]: string[]) => (
                <label key={v} className={`flex items-start gap-3 p-3 rounded-lg border text-sm cursor-pointer transition-colors ${ans[q.id] === v ? 'border-amber-500 bg-amber-50' : 'border-stone-200 hover:bg-stone-50'}`}>
                  <input type="radio" name={'q' + q.id} className="mt-0.5 accent-amber-700" checked={ans[q.id] === v} onChange={() => setA(q.id, v)} />
                  <span>{q.tipo !== 'vf' && <b className="mr-1">{v}.</b>}{t}</span>
                </label>))}</div>
            )}
          </div>))}
        <div className="flex flex-wrap items-center gap-3 pb-8">
          <button className="btn-pri !px-6 !py-2.5" disabled={busy}>{busy ? 'Enviando…' : 'Enviar avaliação'}</button>
          <span className="text-xs text-stone-500">Seu progresso é salvo automaticamente neste aparelho.</span>
        </div>
      </form>
    </Page>
  );
}
