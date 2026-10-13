import React from 'react';
import { sb } from '../../lib/supabase';
import { useApp, useAsync, run } from '../../lib/app';
import { Loading, ErrorBox, Page, Kpi, Bar, Empty } from '../../lib/ui';
import { pct } from '../../lib/util';

export function Painel() {
  const { cfg } = useApp();
  const { data, err, loading } = useAsync(async () => {
    const [tents, temas, qs, tm, turmas, profs, kz] = await Promise.all([
      run(sb.from('tentativas').select('user_id,status,nota_total,nota_max,falha_critica,avaliacoes(mes,titulo)').neq('status', 'em_andamento').range(0, 4999)),
      run(sb.from('v_desempenho_user_tema').select('*').range(0, 4999)),
      run(sb.from('v_questao_stats').select('*').order('pct_acerto', { ascending: true }).limit(8)),
      run(sb.from('turma_membros').select('*')),
      run(sb.from('turmas').select('*')),
      run(sb.from('profiles').select('id,ativo,role')),
      run(sb.from('kaizen_registros').select('id,feedback_em')),
    ]);
    return { tents, temas, qs, tm, turmas, profs, kz };
  }, []);
  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;
  const { tents, temas, qs, tm, turmas, profs, kz } = data!;
  const corr = tents.filter((t: any) => t.status === 'corrigida');
  const pend = tents.filter((t: any) => t.status === 'enviada').length;
  const med = corr.length ? corr.reduce((s: number, t: any) => s + pct(t.nota_total, t.nota_max), 0) / corr.length : 0;
  const aprov = corr.filter((t: any) => pct(t.nota_total, t.nota_max) >= cfg.nota_aprovacao).length;
  const reforco = corr.filter((t: any) => { const p = pct(t.nota_total, t.nota_max); return p >= cfg.nota_reforco && p < cfg.nota_aprovacao; }).length;
  const retre = corr.length - aprov - reforco;
  const crit = tents.filter((t: any) => t.falha_critica).length;
  const pendentesAprov = profs.filter((p: any) => !p.ativo).length;
  const kzSem = kz.filter((r: any) => !r.feedback_em).length;
  const meses: Record<string, number[]> = {};
  corr.forEach((t: any) => { const m = t.avaliacoes?.mes || 'sem mês'; (meses[m] ||= []).push(pct(t.nota_total, t.nota_max)); });
  const mesRows = Object.entries(meses).sort().map(([m, a]) => [m, a.reduce((x, y) => x + y, 0) / a.length, a.length] as [string, number, number]);
  const tAgg: Record<string, { p: number; m: number }> = {};
  temas.forEach((x: any) => { const o = (tAgg[x.tema] ||= { p: 0, m: 0 }); o.p += Number(x.pontos); o.m += Number(x.pontos_max); });
  const tRows = Object.entries(tAgg).map(([t, o]) => [t, pct(o.p, o.m)] as [string, number]).sort((a, b) => a[1] - b[1]);
  const turmaRows = turmas.map((t: any) => {
    const ids = new Set(tm.filter((m: any) => m.turma_id === t.id).map((m: any) => m.user_id));
    const c = corr.filter((x: any) => ids.has(x.user_id));
    return [t.nome, c.length ? c.reduce((s: number, x: any) => s + pct(x.nota_total, x.nota_max), 0) / c.length : null, ids.size] as [string, number | null, number];
  });
  return (
    <Page title="Painel" subtitle="Visão geral da equipe comercial" wide>
      {(pend > 0 || pendentesAprov > 0 || kzSem > 0) && (
        <div className="flex flex-wrap gap-2">
          {pend > 0 && <a href="#/admin/correcoes" className="pill pill-warn !text-xs !py-1">{pend} prova(s) aguardando correção →</a>}
          {kzSem > 0 && <a href="#/admin/kaizen" className="pill pill-warn !text-xs !py-1">{kzSem} registro(s) Kaizen sem feedback →</a>}
          {pendentesAprov > 0 && <a href="#/admin/equipe" className="pill pill-warn !text-xs !py-1">{pendentesAprov} cadastro(s) para aprovar →</a>}
        </div>)}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi v={corr.length} l="provas corrigidas" />
        <Kpi v={`${Math.round(med)}%`} l="média geral" />
        <Kpi v={aprov} l={`aprovadas (≥${cfg.nota_aprovacao}%)`} />
        <Kpi v={reforco} l={`reforço (${cfg.nota_reforco}–${cfg.nota_aprovacao - 1}%)`} />
        <Kpi v={retre} l={`retreinamento (<${cfg.nota_reforco}%)`} hint={crit ? `${crit} com falha crítica` : undefined} />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card"><h2 className="text-xl font-semibold mb-3">Evolução mensal (média)</h2>
          {mesRows.length ? <div className="space-y-2.5">{mesRows.map(([m, v, n]) => <div key={m}><div className="flex justify-between text-xs mb-1"><span>{m} <span className="text-stone-400">({n})</span></span><span className="font-mono">{Math.round(v)}%</span></div><Bar p={v} /></div>)}</div> : <Empty text="Sem provas corrigidas ainda." />}</div>
        <div className="card"><h2 className="text-xl font-semibold mb-3">Temas mais fracos</h2>
          {tRows.length ? <div className="space-y-2.5">{tRows.slice(0, 8).map(([t, v]) => <div key={t}><div className="flex justify-between text-xs mb-1"><span>{t}</span><span className="font-mono">{Math.round(v)}%</span></div><Bar p={v} /></div>)}</div> : <Empty text="Sem dados." />}</div>
        <div className="card"><h2 className="text-xl font-semibold mb-3">Por turma</h2>
          {turmaRows.length ? <div className="space-y-2.5">{turmaRows.map(([n, v, c]) => <div key={n}><div className="flex justify-between text-xs mb-1"><span>{n} <span className="text-stone-400">({c} pessoas)</span></span><span className="font-mono">{v == null ? '—' : Math.round(v) + '%'}</span></div><Bar p={v || 0} /></div>)}</div> : <Empty text="Crie turmas para ver a comparação." />}</div>
        <div className="card"><h2 className="text-xl font-semibold mb-3">Questões mais erradas</h2>
          {qs.length ? <ul className="space-y-2">{qs.map((q: any) => <li key={q.questao_id} className="text-sm flex gap-3"><span className="font-mono text-xs text-red-700 w-10 shrink-0">{Math.round(q.pct_acerto)}%</span><span className="text-stone-700">{q.enunciado.slice(0, 110)}{q.enunciado.length > 110 ? '…' : ''} <span className="text-stone-400 text-xs">({q.tema})</span></span></li>)}</ul> : <Empty text="Sem dados de objetivas." />}</div>
      </div>
    </Page>
  );
}
