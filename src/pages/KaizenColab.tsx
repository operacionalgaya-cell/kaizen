import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { sb } from '../lib/supabase';
import { useApp, useAsync, run, go } from '../lib/app';
import { Loading, ErrorBox, Page, Empty, Field } from '../lib/ui';
import { fmt, STATUS_KZ, MOTIVOS, CATEGORIAS, TEMA_ETAPAS } from '../lib/util';
import { FEEDBACK_FORMATO } from '../data/playbook';

export function KaizenColab() {
  const { me } = useApp();
  const { data, err, loading } = useAsync(() => run(sb.from('kaizen_registros').select('id,categoria,etapa,status,created_at,feedback_em,lido').eq('user_id', me!.id).order('created_at', { ascending: false })), []);
  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;
  return (
    <Page title="Kaizen Gaya" subtitle="Registre as oportunidades efetivamente perdidas e aprenda com o retorno. É um ciclo de aprendizado, não de punição."
      actions={<a href="#/kaizen/novo" className="btn-pri"><Plus className="w-3.5 h-3.5" />Novo registro</a>}>
      {data!.length ? <div className="space-y-2">{data!.map((r: any) => (
        <a key={r.id} href={'#/kaizen/' + r.id} className="card !p-4 flex flex-wrap items-center justify-between gap-2 hover:shadow-md transition-shadow">
          <div><div className="font-semibold text-sm">{r.categoria} · parou na etapa {r.etapa} ({TEMA_ETAPAS[r.etapa - 1]})</div><div className="text-xs text-stone-500">{fmt(r.created_at)} · {STATUS_KZ[r.status]}</div></div>
          {r.feedback_em ? <span className={`pill ${r.lido ? 'pill-ok' : 'pill-warn'}`}>{r.lido ? 'feedback lido' : 'feedback novo'}</span> : <span className="pill">aguardando análise</span>}
        </a>))}</div> : <Empty text="Nenhum registro ainda. Quando uma oportunidade for efetivamente perdida, registre-a aqui." />}
    </Page>
  );
}

export function KaizenNovo() {
  const { me, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState<any>({ categoria: 'SPA', etapa: 2, status: 'perda_confirmada', historico: '', motivo_cliente: '', motivo_categoria: '', hipotese: '', autoavaliacao: '' });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await run(sb.from('kaizen_registros').insert({ user_id: me!.id, categoria: f.categoria, etapa: Number(f.etapa), status: f.status, historico: f.historico.trim(), motivo_cliente: f.motivo_cliente.trim() || null, motivo_categoria: f.motivo_categoria || null, hipotese: f.hipotese.trim() || null, autoavaliacao: f.autoavaliacao.trim() || null }));
      toast('Registro enviado. A coordenação fará a análise.'); go('/kaizen');
    } catch (err: any) { toast(err.message, true); } finally { setBusy(false); }
  };
  return (
    <Page title="Registrar oportunidade" subtitle="Campos mínimos do Kaizen Gaya. Preencha só o essencial.">
      <a href="#/kaizen" className="text-xs text-stone-500 inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" />Voltar</a>
      <form onSubmit={save} className="card space-y-1">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Serviço/categoria de interesse"><select className="inp" value={f.categoria} onChange={set('categoria')}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Etapa em que parou"><select className="inp" value={f.etapa} onChange={set('etapa')}>{TEMA_ETAPAS.map((t, i) => <option key={t} value={i + 1}>{i + 1}. {t}</option>)}</select></Field>
          <Field label="Status do desfecho"><select className="inp" value={f.status} onChange={set('status')}>{Object.entries(STATUS_KZ).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <p className="text-xs text-stone-500">Silêncio do cliente não é, automaticamente, perda definitiva: use “oportunidade parada” ou “recuperável” quando ainda houver potencial.</p>
        <Field label="Histórico integral da conversa (cole aqui)"><textarea className="inp min-h-48" required value={f.historico} onChange={set('historico')} placeholder="Cole a conversa completa do Chatguru. Evite dados sensíveis desnecessários." /></Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Motivo informado pelo cliente (se houver)"><input className="inp" value={f.motivo_cliente} onChange={set('motivo_cliente')} placeholder="O que o cliente disse" /></Field>
          <Field label="Categoria do motivo"><select className="inp" value={f.motivo_categoria} onChange={set('motivo_categoria')}><option value="">—</option>{Object.entries(MOTIVOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        </div>
        <Field label="Hipótese (o que você acha que aconteceu — não é fato)"><textarea className="inp" value={f.hipotese} onChange={set('hipotese')} /></Field>
        <Field label="Autoavaliação: o que você faria diferente?"><textarea className="inp" value={f.autoavaliacao} onChange={set('autoavaliacao')} /></Field>
        <div className="pt-4"><button className="btn-pri" disabled={busy}>{busy ? 'Enviando…' : 'Enviar registro'}</button></div>
      </form>
    </Page>
  );
}

export function KaizenVer({ id }: { id: string }) {
  const { toast } = useApp();
  const { data, err, loading, reload } = useAsync(() => run(sb.from('kaizen_registros').select('*').eq('id', id).single()), [id]);
  const [cont, setCont] = useState('');
  useEffect(() => { if (data) { setCont(data.contestacao || ''); if (data.feedback_em && !data.lido) sb.rpc('kaizen_marcar_lido', { p_id: id }); } }, [data]);
  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;
  const r = data!;
  const contestar = async () => { try { await run(sb.rpc('kaizen_contestar', { p_id: id, p_texto: cont })); toast('Contestação registrada'); reload(); } catch (e: any) { toast(e.message, true); } };
  return (
    <Page title="Registro Kaizen" subtitle={`${r.categoria} · etapa ${r.etapa} · ${STATUS_KZ[r.status]} · ${fmt(r.created_at)}`}>
      <a href="#/kaizen" className="text-xs text-stone-500 inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" />Voltar</a>
      {r.feedback_em ? (
        <div className="card !border-amber-300 !bg-amber-50/60 space-y-3">
          <h2 className="text-2xl font-semibold">Feedback da coordenação</h2>
          {FEEDBACK_FORMATO.map(([k, l]) => r[k] ? <div key={k}><div className="text-xs uppercase tracking-wider text-amber-900 font-semibold">{l}</div><p className="text-sm whitespace-pre-wrap">{r[k]}</p></div> : null)}
          {r.acao_sugerida && <div><div className="text-xs uppercase tracking-wider text-amber-900 font-semibold">Ação sugerida</div><p className="text-sm whitespace-pre-wrap">{r.acao_sugerida}</p></div>}
          <div className="pt-2 border-t border-amber-200"><label className="lbl">Discorda ou quer dar mais contexto? Escreva aqui (canal de contestação)</label>
            <textarea className="inp" value={cont} onChange={(e) => setCont(e.target.value)} /><button className="btn mt-2" onClick={contestar}>Enviar contestação</button></div>
        </div>
      ) : <div className="card text-sm text-stone-600">Aguardando a análise da coordenação.</div>}
      <div className="card space-y-3 text-sm">
        <h2 className="text-xl font-semibold">O que você registrou</h2>
        {r.motivo_cliente && <div><b>Motivo informado pelo cliente:</b> {r.motivo_cliente}</div>}
        {r.motivo_categoria && <div><b>Categoria:</b> {MOTIVOS[r.motivo_categoria]}</div>}
        {r.hipotese && <div><b>Sua hipótese:</b> {r.hipotese}</div>}
        {r.autoavaliacao && <div><b>Autoavaliação:</b> {r.autoavaliacao}</div>}
        <details><summary className="text-xs font-semibold text-amber-800">Ver histórico da conversa</summary><pre className="whitespace-pre-wrap text-xs bg-stone-50 border border-stone-200 rounded p-3 mt-2 max-h-96 overflow-auto font-sans">{r.historico}</pre></details>
      </div>
    </Page>
  );
}
