import React, { useMemo, useState } from 'react';
import { Copy, Plus, Send, Lock, Trash2 } from 'lucide-react';
import { sb } from '../../lib/supabase';
import { useApp, useAsync, run } from '../../lib/app';
import { Loading, ErrorBox, Page, Modal, Empty, Field, Status } from '../../lib/ui';
import { fmt, nextMonth, toLocalInput } from '../../lib/util';

export function Avaliacoes() {
  const { toast } = useApp();
  const { data, err, loading, reload } = useAsync(async () => {
    const [avs, aq, at, turmas, qs] = await Promise.all([
      run(sb.from('avaliacoes').select('*').order('created_at', { ascending: false })),
      run(sb.from('avaliacao_questoes').select('*')), run(sb.from('avaliacao_turmas').select('*')),
      run(sb.from('turmas').select('*').order('nome')), run(sb.from('questoes').select('id,tipo,tema,enunciado,pontos,ativa').eq('ativa', true).order('created_at').range(0, 1999)),
    ]);
    return { avs, aq, at, turmas, qs };
  }, []);
  const [edit, setEdit] = useState<any>(null);
  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;
  const { avs, aq, at, turmas, qs } = data!;
  const act = async (fn: () => Promise<any>, ok?: string | ((r: any) => string)) => { try { const r = await fn(); if (ok) toast(typeof ok === 'function' ? ok(r) : ok); reload(); } catch (e: any) { toast(e.message, true); } };
  const pub = (a: any) => confirm('Publicar e avisar todos os destinatários?') && act(() => run(sb.rpc('publicar_avaliacao', { p_id: a.id })), (n: any) => `Publicada — ${n} pessoa(s) avisada(s)`);
  const end = (a: any) => confirm('Encerrar? O gabarito das objetivas será liberado aos colaboradores.') && act(() => run(sb.from('avaliacoes').update({ status: 'encerrada' }).eq('id', a.id)), 'Avaliação encerrada');
  const del = (a: any) => confirm('Excluir esta avaliação e todos os resultados?') && act(() => run(sb.from('avaliacoes').delete().eq('id', a.id)));
  const dup = (a: any) => act(async () => {
    const nid = (await run(sb.from('avaliacoes').insert({ titulo: a.titulo.replace(/\s*\(cópia\)$/, '') + ' (cópia)', mes: nextMonth(), descricao: a.descricao, tempo_limite_min: a.tempo_limite_min }).select('id').single())).id;
    const q = aq.filter((x: any) => x.avaliacao_id === a.id).map((x: any) => ({ ...x, avaliacao_id: nid }));
    const t = at.filter((x: any) => x.avaliacao_id === a.id).map((x: any) => ({ ...x, avaliacao_id: nid }));
    if (q.length) await run(sb.from('avaliacao_questoes').insert(q));
    if (t.length) await run(sb.from('avaliacao_turmas').insert(t));
  }, 'Rascunho criado para o próximo mês');
  return (
    <Page title="Avaliações" subtitle="Uma prova por mês; duplique para montar a próxima com novos cases" wide actions={<button className="btn-pri" onClick={() => setEdit({})}><Plus className="w-3.5 h-3.5" />Nova avaliação</button>}>
      {avs.length ? <div className="space-y-3">{avs.map((a: any) => (
        <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3">
          <div><div className="flex items-center gap-2"><h3 className="text-xl font-semibold">{a.titulo}</h3><Status s={a.status} /></div>
            <div className="text-xs text-stone-500">{a.mes || 'sem mês'} · {aq.filter((x: any) => x.avaliacao_id === a.id).length} questões · {at.filter((x: any) => x.avaliacao_id === a.id).map((x: any) => turmas.find((t: any) => t.id === x.turma_id)?.nome).filter(Boolean).join(', ') || 'sem turma'} · prazo {fmt(a.prazo)}{a.tempo_limite_min ? ` · ${a.tempo_limite_min} min` : ''}</div></div>
          <div className="flex flex-wrap gap-2">
            {a.status === 'rascunho' && <button className="btn" onClick={() => setEdit(a)}>Editar</button>}
            {a.status === 'rascunho' && <button className="btn-pri" onClick={() => pub(a)}><Send className="w-3.5 h-3.5" />Publicar</button>}
            {a.status === 'publicada' && <button className="btn" onClick={() => end(a)}><Lock className="w-3.5 h-3.5" />Encerrar</button>}
            <button className="btn" onClick={() => dup(a)}><Copy className="w-3.5 h-3.5" />Duplicar p/ próximo mês</button>
            <button className="btn-dan" onClick={() => del(a)} aria-label="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>))}</div> : <Empty text="Nenhuma avaliação. Crie a primeira escolhendo turmas e questões." />}
      {edit && <AvaliacaoModal a={edit} turmas={turmas} qs={qs} aq={aq.filter((x: any) => x.avaliacao_id === edit.id)} at={at.filter((x: any) => x.avaliacao_id === edit.id)} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </Page>
  );
}

function AvaliacaoModal({ a, turmas, qs, aq, at, onClose, onSaved }: any) {
  const { toast } = useApp();
  const [f, setF] = useState({ titulo: a.titulo || '', mes: a.mes || new Date().toISOString().slice(0, 7), descricao: a.descricao || '', tempo: a.tempo_limite_min ?? '', prazo: toLocalInput(a.prazo) });
  const [tsel, setT] = useState<Set<string>>(new Set(at.map((x: any) => x.turma_id)));
  const [qsel, setQ] = useState<string[]>(aq.sort((x: any, y: any) => x.ordem - y.ordem).map((x: any) => x.questao_id));
  const [filtro, setFiltro] = useState('');
  const temas = useMemo(() => [...new Set(qs.map((q: any) => q.tema))].sort() as string[], [qs]);
  const toggleQ = (id: string) => setQ((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleTema = (t: string) => { const ids = qs.filter((q: any) => q.tema === t).map((q: any) => q.id); const all = ids.every((i: string) => qsel.includes(i)); setQ((s) => all ? s.filter((x) => !ids.includes(x)) : [...s, ...ids.filter((i: string) => !s.includes(i))]); };
  const total = qsel.reduce((s, id) => s + Number(qs.find((q: any) => q.id === id)?.pontos || 0), 0);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const row = { titulo: f.titulo.trim(), mes: f.mes || null, descricao: f.descricao.trim() || null, tempo_limite_min: f.tempo ? Number(f.tempo) : null, prazo: f.prazo ? new Date(f.prazo).toISOString() : null };
      let id = a.id;
      if (id) await run(sb.from('avaliacoes').update(row).eq('id', id)); else id = (await run(sb.from('avaliacoes').insert(row).select('id').single())).id;
      await run(sb.from('avaliacao_questoes').delete().eq('avaliacao_id', id));
      await run(sb.from('avaliacao_turmas').delete().eq('avaliacao_id', id));
      if (qsel.length) await run(sb.from('avaliacao_questoes').insert(qsel.map((questao_id, i) => ({ avaliacao_id: id, questao_id, ordem: i }))));
      if (tsel.size) await run(sb.from('avaliacao_turmas').insert([...tsel].map((turma_id) => ({ avaliacao_id: id, turma_id }))));
      toast('Avaliação salva'); onSaved();
    } catch (er: any) { toast(er.message, true); }
  };
  const vis = qs.filter((q: any) => !filtro || q.enunciado.toLowerCase().includes(filtro.toLowerCase()) || q.tema.toLowerCase().includes(filtro.toLowerCase()));
  return (
    <Modal title={a.id ? 'Editar avaliação' : 'Nova avaliação'} onClose={onClose} wide>
      <form onSubmit={save}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Título"><input className="inp" required value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Ex.: Avaliação Jeito Gaya — Outubro" /></Field>
          <Field label="Mês de referência"><input className="inp" type="month" value={f.mes} onChange={(e) => setF({ ...f, mes: e.target.value })} /></Field>
          <Field label="Prazo"><input className="inp" type="datetime-local" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} /></Field>
          <Field label="Tempo limite (min) — opcional"><input className="inp" type="number" min="1" value={f.tempo} onChange={(e) => setF({ ...f, tempo: e.target.value })} placeholder="60–75 sugerido" /></Field>
        </div>
        <Field label="Descrição"><input className="inp" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Field>
        <label className="lbl">Turmas</label>
        <div className="flex flex-wrap gap-2">{turmas.map((t: any) => <label key={t.id} className={`px-3 py-1.5 rounded-full border text-xs cursor-pointer ${tsel.has(t.id) ? 'bg-amber-100 border-amber-400' : 'border-stone-300'}`}><input type="checkbox" hidden checked={tsel.has(t.id)} onChange={() => setT((s) => { const n = new Set(s); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n; })} />{t.nome}</label>)}{!turmas.length && <span className="text-xs text-stone-400">Crie turmas primeiro.</span>}</div>
        <div className="flex items-center justify-between mt-4"><label className="lbl !m-0">Questões — {qsel.length} selecionadas · {total} pontos</label><input className="inp !w-56" placeholder="Filtrar…" value={filtro} onChange={(e) => setFiltro(e.target.value)} /></div>
        <div className="flex flex-wrap gap-1.5 my-2">{temas.map((t) => <button key={t} type="button" className="btn !py-1" onClick={() => toggleTema(t)}>{t}</button>)}</div>
        <div className="max-h-72 overflow-auto border border-stone-200 rounded-md divide-y divide-stone-100">{vis.map((q: any) => (
          <label key={q.id} className="flex items-start gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-stone-50"><input type="checkbox" className="mt-1 accent-amber-700" checked={qsel.includes(q.id)} onChange={() => toggleQ(q.id)} /><span><span className="pill mr-2">{q.tema}</span>{q.enunciado}</span></label>))}</div>
        <div className="flex gap-2 mt-5"><button className="btn-pri">Salvar rascunho</button><button type="button" className="btn" onClick={onClose}>Cancelar</button></div>
      </form>
    </Modal>
  );
}
