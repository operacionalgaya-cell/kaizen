import React, { useEffect, useState } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { sb } from '../../lib/supabase';
import { useApp, useAsync, run, go } from '../../lib/app';
import { Loading, ErrorBox, Page, Empty, Status } from '../../lib/ui';
import { fmt, num, pct } from '../../lib/util';
import { FeedbackModal } from './Feedback';
import { answerText } from '../Resultado';

export function Correcoes() {
  const { data, err, loading } = useAsync(() => run(sb.from('tentativas').select('*,profiles(nome,email),avaliacoes(titulo,mes)').in('status', ['enviada', 'corrigida']).order('enviada_em', { ascending: false }).limit(150)), []);
  const [fb, setFb] = useState<string | null>(null);
  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;
  const pend = data!.filter((t: any) => t.status === 'enviada'), done = data!.filter((t: any) => t.status === 'corrigida');
  const Row = ({ t }: any) => (
    <tr><td className="td font-medium">{t.profiles?.nome || t.profiles?.email}</td><td className="td">{t.avaliacoes?.titulo}</td><td className="td text-xs">{fmt(t.enviada_em)}</td>
      <td className="td">{t.status === 'corrigida' ? <>{num(t.nota_total)}/{num(t.nota_max)} <span className="text-stone-400">({Math.round(pct(t.nota_total, t.nota_max))}%)</span>{t.falha_critica && <span className="pill pill-bad ml-1">crítica</span>}</> : <Status s={t.status} />}</td>
      <td className="td text-right whitespace-nowrap"><a className={t.status === 'enviada' ? 'btn-pri' : 'btn'} href={'#/admin/corrigir/' + t.id}>{t.status === 'enviada' ? 'Corrigir' : 'Revisar'}</a>{t.status === 'corrigida' && <button className="btn ml-2" onClick={() => setFb(t.id)}>Feedback</button>}</td></tr>);
  return (
    <Page title="Correções" subtitle="Questões abertas aguardando nota" wide>
      <section><h2 className="text-xl font-semibold mb-2">Aguardando correção ({pend.length})</h2>
        {pend.length ? <div className="card !p-0 overflow-x-auto"><table className="w-full"><tbody>{pend.map((t: any) => <Row key={t.id} t={t} />)}</tbody></table></div> : <Empty text="Nada pendente. 🎉" />}</section>
      <section><h2 className="text-xl font-semibold mb-2">Corrigidas recentemente</h2>
        {done.length ? <div className="card !p-0 overflow-x-auto"><table className="w-full"><tbody>{done.map((t: any) => <Row key={t.id} t={t} />)}</tbody></table></div> : <Empty text="Ainda sem correções." />}</section>
      {fb && <FeedbackModal tid={fb} onClose={() => setFb(null)} />}
    </Page>
  );
}

export function Corrigir({ id }: { id: string }) {
  const { toast } = useApp();
  const { data, err, loading } = useAsync(async () => {
    const r = await run(sb.rpc('resultado_tentativa', { p_tentativa: id }));
    const { data: prof } = await sb.from('profiles').select('nome,email,unidade').eq('id', r.tentativa.user_id).single();
    return { r, prof };
  }, [id]);
  const [notas, setNotas] = useState<Record<string, { pontos: number | null; comentario: string }>>({});
  const [meta, setMeta] = useState({ simulacao_validada: false, falha_critica: false, observacoes: '' });
  const [busy, setBusy] = useState(false);
  const [fb, setFb] = useState(false);
  useEffect(() => {
    if (!data) return;
    const n: any = {}; data.r.itens.filter((q: any) => q.tipo === 'aberta').forEach((q: any) => { n[q.questao_id] = { pontos: q.pontos, comentario: q.comentario || '' }; });
    setNotas(n); const t = data.r.tentativa; setMeta({ simulacao_validada: !!t.simulacao_validada, falha_critica: !!t.falha_critica, observacoes: t.observacoes || '' });
  }, [data]);
  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;
  const { r, prof } = data!;
  const abertas = r.itens.filter((q: any) => q.tipo === 'aberta');
  const set = (qid: string, patch: any) => setNotas((n) => ({ ...n, [qid]: { ...n[qid], ...patch } }));
  const sem = abertas.filter((q: any) => notas[q.questao_id]?.pontos == null).length;
  const parcial = r.tentativa.nota_auto != null ? Number(r.tentativa.nota_auto) + abertas.reduce((s: number, q: any) => s + Number(notas[q.questao_id]?.pontos || 0), 0) : 0;
  const salvar = async () => {
    setBusy(true);
    try {
      const arr = abertas.filter((q: any) => notas[q.questao_id]?.pontos != null).map((q: any) => ({ questao_id: q.questao_id, pontos: notas[q.questao_id].pontos, comentario: notas[q.questao_id].comentario }));
      await run(sb.rpc('corrigir_tentativa', { p_tentativa: id, p_notas: arr, p_meta: meta }));
      toast(sem ? 'Correção parcial salva' : 'Correção concluída'); if (!sem) setFb(true); else go('/admin/correcoes');
    } catch (e: any) { toast(e.message, true); } finally { setBusy(false); }
  };
  return (
    <Page title={`Correção · ${prof?.nome || prof?.email}`} subtitle={`${r.avaliacao.titulo}${prof?.unidade ? ' · ' + prof.unidade : ''} · enviada em ${fmt(r.tentativa.enviada_em)}${r.tentativa.fora_do_tempo ? ' · FORA DO TEMPO' : ''}`}>
      <a href="#/admin/correcoes" className="text-xs text-stone-500 inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" />Voltar</a>
      <div className="card flex flex-wrap items-center justify-between gap-3"><div><div className="text-xs text-stone-500">Nota parcial (objetivas + abertas lançadas)</div><div className="text-2xl font-bold font-mono">{num(parcial)} / {num(r.tentativa.nota_max)} <span className="text-base text-stone-400">({Math.round(pct(parcial, r.tentativa.nota_max))}%)</span></div></div>
        <div className="text-xs text-stone-500">{abertas.length - sem}/{abertas.length} abertas corrigidas</div></div>
      <p className="text-xs text-stone-500">A correção é manual, guiada pela rubrica. (A correção assistida por IA ficará para uma próxima fase.)</p>
      {abertas.map((q: any, i: number) => {
        const n = notas[q.questao_id] || { pontos: null, comentario: '' }; const max = Number(q.pontos_max);
        return (
          <div key={q.questao_id} className="card space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-stone-500 font-semibold"><span>{q.tema}{q.topico ? ' · ' + q.topico : ''}</span>{q.critica && <span className="pill pill-bad">crítica</span>}</div>
            <p className="font-semibold">{q.enunciado}</p>
            {q.aviso_critico && <div className="text-xs text-red-800 bg-red-50 border border-red-200 rounded p-2 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{q.aviso_critico}</div>}
            <div><div className="text-xs font-semibold text-stone-500 mb-1">Resposta da consultora</div><div className="text-sm whitespace-pre-wrap bg-stone-50 border border-stone-200 rounded p-3">{answerText(q, q.resposta)}</div></div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="text-sm bg-emerald-50 border border-emerald-200 rounded p-3"><div className="text-xs font-semibold text-emerald-900 mb-1">Resposta de referência</div><div className="whitespace-pre-wrap">{q.gabarito}</div></div>
              <div className="text-sm bg-amber-50/60 border border-amber-200 rounded p-3 space-y-2">
                {q.elementos_chave?.length > 0 && <div><div className="text-xs font-semibold text-amber-900 mb-1">Elementos-chave</div><ul className="list-disc pl-4 space-y-0.5">{q.elementos_chave.map((e: string) => <li key={e}>{e}</li>)}</ul></div>}
                {q.rubrica && <div className="text-xs text-stone-600">{q.rubrica}</div>}
              </div>
            </div>
            <div><div className="text-xs font-semibold text-stone-500 mb-1">Nota (0–{max})</div>
              <div className="flex flex-wrap gap-2">{[0, 1, 2, 3].filter((v) => v <= max).map((v) => (
                <button key={v} type="button" onClick={() => set(q.questao_id, { pontos: v })} className={`w-10 h-10 rounded-lg border font-bold font-mono ${n.pontos === v ? 'bg-amber-800 text-white border-amber-800' : 'bg-white border-stone-300 hover:bg-stone-50'}`}>{v}</button>))}
                {max > 3 && <input type="number" className="inp !w-24" min="0" max={max} step="0.5" value={n.pontos ?? ''} onChange={(e) => set(q.questao_id, { pontos: e.target.value === '' ? null : Number(e.target.value) })} />}</div>
              {q.criterios && n.pontos != null && q.criterios[String(Math.round(n.pontos))] && <p className="text-xs text-stone-600 mt-2 bg-stone-50 rounded p-2"><b>Nota {Math.round(n.pontos)}:</b> {q.criterios[String(Math.round(n.pontos))]}</p>}
              {q.criterios && <details className="mt-1"><summary className="text-xs text-amber-800 font-semibold">Ver todos os critérios</summary><ul className="text-xs text-stone-600 mt-1 space-y-1">{[0, 1, 2, 3].map((v) => <li key={v}><b>{v}:</b> {q.criterios[String(v)]}</li>)}</ul></details>}
            </div>
            <textarea className="inp" placeholder="Comentário para a consultora (opcional)" value={n.comentario} onChange={(e) => set(q.questao_id, { comentario: e.target.value })} />
          </div>);
      })}
      <div className="card space-y-3">
        <h2 className="text-xl font-semibold">Fechamento da correção</h2>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-red-700" checked={meta.falha_critica} onChange={(e) => setMeta({ ...meta, falha_critica: e.target.checked })} /><span><b>Falha crítica identificada</b> — inventar disponibilidade, confirmar reserva inexistente, transmitir informação comercial incorreta ou desrespeitar a decisão do cliente. Exige correção e simulação prática, independentemente da nota.</span></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-emerald-700" checked={meta.simulacao_validada} onChange={(e) => setMeta({ ...meta, simulacao_validada: e.target.checked })} /><span><b>Simulação prática validada</b> — conversa realista aplicada e aprovada pela coordenação.</span></label>
        <div><label className="lbl">Observações gerais</label><textarea className="inp" value={meta.observacoes} onChange={(e) => setMeta({ ...meta, observacoes: e.target.value })} /></div>
        <div className="flex gap-2"><button className="btn-pri" disabled={busy} onClick={salvar}><CheckCircle2 className="w-3.5 h-3.5" />{sem ? `Salvar parcial (${sem} sem nota)` : 'Concluir correção'}</button></div>
      </div>
      {fb && <FeedbackModal tid={id} onClose={() => { setFb(false); go('/admin/correcoes'); }} />}
    </Page>
  );
}
