import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { sb } from '../../lib/supabase';
import { useApp, useAsync, run } from '../../lib/app';
import { Loading, ErrorBox, Page, Modal, Empty, Field, Kpi, Bar } from '../../lib/ui';
import { fmt, fmtDay, STATUS_KZ, MOTIVOS, TEMA_ETAPAS } from '../../lib/util';
import { FEEDBACK_FORMATO, GOVERNANCA, INDICADORES } from '../../data/playbook';

export function KaizenAdmin({ openId }: { openId?: string }) {
  const { toast } = useApp();
  const [tab, setTab] = useState<'reg' | 'ind' | 'acoes'>('reg');
  const [sel, setSel] = useState<string | null>(openId || null);
  const [fil, setFil] = useState({ st: 'sem', cat: '', user: '' });
  const { data, err, loading, reload } = useAsync(async () => {
    const [regs, acoes] = await Promise.all([
      run(sb.from('kaizen_registros').select('*,profiles!kaizen_registros_user_id_fkey(nome,email,unidade)').order('created_at', { ascending: false }).range(0, 2999)),
      run(sb.from('kaizen_acoes').select('*').order('created_at', { ascending: false })),
    ]);
    return { regs, acoes };
  }, []);
  useEffect(() => { if (openId) setSel(openId); }, [openId]);
  const users = useMemo(() => { const m = new Map<string, string>(); (data?.regs || []).forEach((r: any) => m.set(r.user_id, r.profiles?.nome || r.profiles?.email)); return [...m.entries()]; }, [data]);
  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;
  const { regs, acoes } = data!;
  const list = regs.filter((r: any) => (fil.st === 'sem' ? !r.feedback_em : fil.st === 'com' ? !!r.feedback_em : true) && (!fil.cat || r.categoria === fil.cat) && (!fil.user || r.user_id === fil.user));
  const cur = regs.find((r: any) => r.id === sel);
  return (
    <Page title="Kaizen Gaya" subtitle="Registro de oportunidades perdidas, feedback individual, indicadores e plano de ação" wide>
      <div className="flex gap-1 border-b border-stone-200">{([['reg', 'Registros'], ['ind', 'Indicadores de atrito'], ['acoes', 'Plano de ação']] as const).map(([k, l]) => (
        <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === k ? 'border-amber-700 text-amber-900' : 'border-transparent text-stone-500 hover:text-stone-900'}`}>{l}</button>))}</div>

      {tab === 'reg' && <>
        <div className="flex flex-wrap gap-2">
          <select className="inp !w-auto" value={fil.st} onChange={(e) => setFil({ ...fil, st: e.target.value })}><option value="sem">Sem feedback</option><option value="com">Com feedback</option><option value="todos">Todos</option></select>
          <select className="inp !w-auto" value={fil.cat} onChange={(e) => setFil({ ...fil, cat: e.target.value })}><option value="">Todas as categorias</option>{['SPA', 'Yoga', 'Gift Card', 'Outro'].map((c) => <option key={c}>{c}</option>)}</select>
          <select className="inp !w-auto" value={fil.user} onChange={(e) => setFil({ ...fil, user: e.target.value })}><option value="">Todas as consultoras</option>{users.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        </div>
        {list.length ? <div className="card !p-0 overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Consultora</th><th className="th">Categoria</th><th className="th">Parou na etapa</th><th className="th">Desfecho</th><th className="th">Quando</th><th className="th" /></tr></thead><tbody>
          {list.map((r: any) => (<tr key={r.id}><td className="td font-medium">{r.profiles?.nome || r.profiles?.email}</td><td className="td">{r.categoria}</td><td className="td text-xs">{r.etapa}. {TEMA_ETAPAS[r.etapa - 1]}</td><td className="td text-xs">{STATUS_KZ[r.status]}</td><td className="td text-xs">{fmt(r.created_at)}</td>
            <td className="td text-right whitespace-nowrap">{r.contestacao && <span className="pill pill-warn mr-2" title="Há contestação">contestado</span>}<button className={r.feedback_em ? 'btn' : 'btn-pri'} onClick={() => setSel(r.id)}>{r.feedback_em ? 'Revisar' : 'Analisar'}</button></td></tr>))}</tbody></table></div> : <Empty text="Nenhum registro neste filtro." />}
      </>}

      {tab === 'ind' && <Indicadores regs={regs} />}
      {tab === 'acoes' && <Acoes acoes={acoes} reload={reload} toast={toast} />}
      {cur && <AnaliseModal r={cur} onClose={() => setSel(null)} onSaved={() => { setSel(null); reload(); }} />}
    </Page>
  );
}

function AnaliseModal({ r, onClose, onSaved }: any) {
  const { me, toast } = useApp();
  const [f, setF] = useState<any>(() => Object.fromEntries([...FEEDBACK_FORMATO.map(([k]) => [k, r[k] || '']), ['acao_sugerida', r.acao_sugerida || ''], ['motivo_categoria', r.motivo_categoria || ''], ['status', r.status]]));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!f.fb_bem.trim() && !f.fb_melhoria.trim()) throw new Error('Preencha ao menos “o que foi bem” ou “oportunidade de melhoria”.');
      await run(sb.from('kaizen_registros').update({ ...f, motivo_categoria: f.motivo_categoria || null, feedback_por: me!.id, feedback_em: new Date().toISOString() }).eq('id', r.id));
      toast('Feedback enviado à consultora'); onSaved();
    } catch (er: any) { toast(er.message, true); }
  };
  return (
    <Modal title={`Análise · ${r.profiles?.nome || r.profiles?.email}`} onClose={onClose} wide>
      <div className="text-xs text-stone-500 mb-2">{r.categoria} · parou na etapa {r.etapa} ({TEMA_ETAPAS[r.etapa - 1]}) · {fmt(r.created_at)}</div>
      <div className="grid md:grid-cols-2 gap-3 text-sm">
        <div className="space-y-2">
          {r.motivo_cliente && <div><b>Motivo informado pelo cliente:</b> {r.motivo_cliente}</div>}
          {r.hipotese && <div><b>Hipótese da consultora:</b> {r.hipotese}</div>}
          {r.autoavaliacao && <div><b>Autoavaliação:</b> {r.autoavaliacao}</div>}
          {r.contestacao && <div className="p-2 rounded bg-amber-50 border border-amber-200"><b className="flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />Contestação:</b> {r.contestacao}</div>}
        </div>
        <pre className="whitespace-pre-wrap text-xs bg-stone-50 border border-stone-200 rounded p-3 max-h-72 overflow-auto font-sans">{r.historico}</pre>
      </div>
      <form onSubmit={save} className="mt-3">
        <div className="p-3 rounded bg-stone-50 border border-stone-200 text-xs text-stone-600 mb-2">Separe <b>evidência</b> (trecho do histórico) de <b>hipótese</b>. Não invente falas, intenções, preços ou disponibilidade. Nem toda perda é falha de atendimento.</div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Status do desfecho"><select className="inp" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>{Object.entries(STATUS_KZ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Categoria do motivo (consolidação)"><select className="inp" value={f.motivo_categoria} onChange={(e) => setF({ ...f, motivo_categoria: e.target.value })}><option value="">—</option>{Object.entries(MOTIVOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        {FEEDBACK_FORMATO.map(([k, l]) => <Field key={k} label={l}><textarea className="inp" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>)}
        <Field label="Ação sugerida / próxima ação"><textarea className="inp" value={f.acao_sugerida} onChange={(e) => setF({ ...f, acao_sugerida: e.target.value })} /></Field>
        <div className="flex gap-2 mt-5"><button className="btn-pri">Enviar feedback</button><button type="button" className="btn" onClick={onClose}>Fechar</button></div>
      </form>
    </Modal>
  );
}

function Indicadores({ regs }: { regs: any[] }) {
  const n = regs.length;
  const count = (fn: (r: any) => string) => { const m: Record<string, number> = {}; regs.forEach((r) => { const k = fn(r); m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const comMotivo = regs.filter((r) => r.motivo_categoria).length;
  const comFb = regs.filter((r) => r.feedback_em);
  const horas = comFb.length ? comFb.reduce((s, r) => s + (+new Date(r.feedback_em) - +new Date(r.created_at)) / 3.6e6, 0) / comFb.length : null;
  const Dist = ({ title, rows }: { title: string; rows: [string, number][] }) => (
    <div className="card"><h2 className="text-xl font-semibold mb-3">{title}</h2>{rows.length ? <div className="space-y-2.5">{rows.map(([k, v]) => <div key={k}><div className="flex justify-between text-xs mb-1"><span>{k}</span><span className="font-mono">{v} ({Math.round((v / n) * 100)}%)</span></div><Bar p={(v / n) * 100} className="[&>div]:!bg-amber-600" /></div>)}</div> : <Empty text="Sem dados." />}</div>);
  const [a, setA] = useState({ A: '', B: '', rec: '', el: '' });
  const conv = Number(a.A) > 0 ? (Number(a.B) / Number(a.A)) * 100 : null;
  const recp = Number(a.el) > 0 ? (Number(a.rec) / Number(a.el)) * 100 : null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Kpi v={n} l="registros" /><Kpi v={n ? Math.round((comMotivo / n) * 100) + '%' : '—'} l="com motivo categorizado" /><Kpi v={comFb.length} l="com feedback devolvido" /><Kpi v={horas == null ? '—' : horas < 48 ? Math.round(horas) + ' h' : Math.round(horas / 24) + ' d'} l="tempo médio até o feedback" /></div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Dist title="Onde as oportunidades param (etapa)" rows={count((r) => `${r.etapa}. ${TEMA_ETAPAS[r.etapa - 1]}`)} />
        <Dist title="Motivos de perda / estagnação" rows={count((r) => (r.motivo_categoria ? MOTIVOS[r.motivo_categoria] : 'Sem categoria'))} />
        <Dist title="Por categoria" rows={count((r) => r.categoria)} />
        <Dist title="Status do desfecho" rows={count((r) => STATUS_KZ[r.status])} />
      </div>
      <div className="card"><h2 className="text-xl font-semibold mb-1">Calculadora de funil</h2>
        <p className="text-xs text-stone-500 mb-3">Os volumes do funil vêm do Pipedrive (fonte oficial). Informe os números da coorte para calcular com os denominadores corretos.</p>
        <div className="grid sm:grid-cols-2 gap-6">
          <div><div className="text-sm font-semibold">Conversão entre etapas</div><div className="text-xs text-stone-500 mb-2">Chegaram à etapa B ÷ chegaram à etapa A × 100</div>
            <div className="flex gap-2"><input className="inp" type="number" min="0" placeholder="Etapa A (denominador)" value={a.A} onChange={(e) => setA({ ...a, A: e.target.value })} /><input className="inp" type="number" min="0" placeholder="Etapa B" value={a.B} onChange={(e) => setA({ ...a, B: e.target.value })} /></div>
            <div className="text-2xl font-serif-display font-semibold text-amber-900 mt-2">{conv == null ? '—' : conv.toFixed(1).replace('.', ',') + '%'}</div></div>
          <div><div className="text-sm font-semibold">Taxa de recuperação</div><div className="text-xs text-stone-500 mb-2">Recuperadas ÷ elegíveis na coorte × 100</div>
            <div className="flex gap-2"><input className="inp" type="number" min="0" placeholder="Elegíveis (denominador)" value={a.el} onChange={(e) => setA({ ...a, el: e.target.value })} /><input className="inp" type="number" min="0" placeholder="Recuperadas" value={a.rec} onChange={(e) => setA({ ...a, rec: e.target.value })} /></div>
            <div className="text-2xl font-serif-display font-semibold text-amber-900 mt-2">{recp == null ? '—' : recp.toFixed(1).replace('.', ',') + '%'}</div></div>
        </div></div>
      <div className="card"><h2 className="text-xl font-semibold mb-2">Definições oficiais</h2><ul className="text-sm space-y-1.5">{INDICADORES.map(([t, d]) => <li key={t}><b>{t}:</b> <span className="text-stone-600">{d}</span></li>)}</ul>
        <h3 className="text-lg font-semibold mt-4 mb-1">Cuidados de interpretação</h3><ul className="list-disc pl-5 text-sm text-stone-600 space-y-1">{GOVERNANCA.map((g) => <li key={g}>{g}</li>)}</ul></div>
    </div>
  );
}

function Acoes({ acoes, reload, toast }: any) {
  const [f, setF] = useState({ descricao: '', responsavel: '', prazo: '', indicador: '' });
  const add = async (e: React.FormEvent) => { e.preventDefault(); try { await run(sb.from('kaizen_acoes').insert({ descricao: f.descricao.trim(), responsavel: f.responsavel.trim() || null, prazo: f.prazo || null, indicador: f.indicador.trim() || null })); setF({ descricao: '', responsavel: '', prazo: '', indicador: '' }); reload(); } catch (er: any) { toast(er.message, true); } };
  const upd = async (id: string, patch: any) => { try { await run(sb.from('kaizen_acoes').update(patch).eq('id', id)); reload(); } catch (er: any) { toast(er.message, true); } };
  const del = async (id: string) => { if (confirm('Excluir esta ação?')) { await run(sb.from('kaizen_acoes').delete().eq('id', id)); reload(); } };
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="card"><h2 className="text-xl font-semibold">Nova ação</h2><p className="text-xs text-stone-500">Toda ação relevante tem responsável, prazo, indicador de acompanhamento e status.</p>
        <Field label="Ação"><input className="inp" required value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Ex.: Reforçar qualificação do perfil B no treinamento de sexta" /></Field>
        <div className="grid sm:grid-cols-3 gap-3"><Field label="Responsável"><input className="inp" value={f.responsavel} onChange={(e) => setF({ ...f, responsavel: e.target.value })} /></Field><Field label="Prazo"><input className="inp" type="date" value={f.prazo} onChange={(e) => setF({ ...f, prazo: e.target.value })} /></Field><Field label="Indicador de acompanhamento"><input className="inp" value={f.indicador} onChange={(e) => setF({ ...f, indicador: e.target.value })} /></Field></div>
        <button className="btn-pri mt-4"><Plus className="w-3.5 h-3.5" />Adicionar</button></form>
      {acoes.length ? <div className="card !p-0 overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Ação</th><th className="th">Responsável</th><th className="th">Prazo</th><th className="th">Indicador</th><th className="th">Status</th><th className="th" /></tr></thead><tbody>
        {acoes.map((a: any) => <tr key={a.id}><td className="td">{a.descricao}</td><td className="td text-xs">{a.responsavel || '—'}</td><td className="td text-xs">{fmtDay(a.prazo)}</td><td className="td text-xs">{a.indicador || '—'}</td>
          <td className="td"><select className="inp !w-auto !py-1" value={a.status} onChange={(e) => upd(a.id, { status: e.target.value })}><option value="aberta">Aberta</option><option value="andamento">Em andamento</option><option value="concluida">Concluída</option></select></td>
          <td className="td"><button className="btn-dan" aria-label="Excluir" onClick={() => del(a.id)}><Trash2 className="w-3.5 h-3.5" /></button></td></tr>)}</tbody></table></div> : <Empty text="Nenhuma ação cadastrada." />}
    </div>
  );
}
