import React, { useEffect } from 'react';
import { AlertTriangle, ArrowLeft, Download, Printer, ShieldCheck, Lightbulb } from 'lucide-react';
import { sb } from '../lib/supabase';
import { useApp, useAsync, run } from '../lib/app';
import { Loading, ErrorBox, Page, Status, Bar } from '../lib/ui';
import { fmt, num, pct, faixa, faixaCls, letter, pdf, slug } from '../lib/util';

export function answerText(q: any, v: any) {
  if (v == null || v === '') return '(em branco)';
  if (q.tipo === 'vf') return v === 'V' ? 'Verdadeiro' : 'Falso';
  if (q.tipo === 'multipla') { const i = String(v).toUpperCase().charCodeAt(0) - 65; return `${v}. ${q.opcoes?.[i] ?? ''}`; }
  return String(v);
}

export async function exportResultadoPdf(tid: string) {
  const r = await run(sb.rpc('resultado_tentativa', { p_tentativa: tid }));
  const { data: prof } = await sb.from('profiles').select('nome').eq('id', r.tentativa.user_id).single();
  const t = r.tentativa;
  const rows = r.itens.map((q: any, i: number) => [i + 1, q.tema, q.enunciado, q.resposta ? (q.tipo === 'aberta' ? String(q.resposta).slice(0, 400) : q.resposta) : '(branco)', q.gabarito != null && q.tipo !== 'aberta' ? q.gabarito : '', q.pontos == null ? 'pend.' : `${num(q.pontos)}/${num(q.pontos_max)}`]);
  await pdf(`Kaizen — ${r.avaliacao.titulo}`, `${prof?.nome || ''} · ${t.status === 'corrigida' ? `${num(t.nota_total)}/${num(t.nota_max)} (${Math.round(pct(t.nota_total, t.nota_max))}%)` : 'aguardando correção'} · ${fmt(t.enviada_em)}`, ['#', 'Tema', 'Questão', 'Resposta', 'Gabarito', 'Pts'], rows, `kaizen-${slug(prof?.nome || 'resultado')}.pdf`);
}

export function Resultado({ id }: { id: string }) {
  const { me, cfg, toast } = useApp();
  const { data, err, loading } = useAsync(async () => {
    const r = await run(sb.rpc('resultado_tentativa', { p_tentativa: id }));
    const fbs = await run(sb.from('feedbacks').select('*').eq('tentativa_id', id).order('created_at', { ascending: false }));
    return { r, fbs };
  }, [id]);
  useEffect(() => { if (data && data.r.tentativa.user_id === me!.id) sb.from('feedbacks').update({ lido: true }).eq('tentativa_id', id).eq('user_id', me!.id).then(() => {}); }, [data]);
  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;
  const { r, fbs } = data!;
  const t = r.tentativa; const own = t.user_id === me!.id; const adm = me!.role === 'admin';
  const p = pct(t.nota_total, t.nota_max); const corrigida = t.status === 'corrigida';
  const fx = faixa(p, cfg.nota_aprovacao, cfg.nota_reforco);
  const critErr = r.itens.filter((q: any) => q.critica && (q.correta === false || (q.tipo === 'aberta' && q.pontos != null && Number(q.pontos) < Number(q.pontos_max) * 0.5)));
  const falha = t.falha_critica || critErr.length > 0;
  const parte = (tipo: string) => { const it = r.itens.filter((q: any) => q.tipo === tipo); return { p: it.reduce((s: number, q: any) => s + Number(q.pontos || 0), 0), m: it.reduce((s: number, q: any) => s + Number(q.pontos_max || 0), 0), n: it.length }; };
  const mc = parte('multipla'), vf = parte('vf'), ab = parte('aberta');
  const temas: Record<string, { p: number; m: number }> = {};
  r.itens.forEach((q: any) => { if (q.pontos != null) { const o = (temas[q.tema] ||= { p: 0, m: 0 }); o.p += Number(q.pontos); o.m += Number(q.pontos_max); } });

  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-2 no-print">
        <a href={own ? '#/' : '#/admin/equipe'} className="text-xs text-stone-500 hover:text-stone-900 inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" />Voltar</a>
        <div className="flex gap-2"><button className="btn" onClick={() => exportResultadoPdf(id).catch((e) => toast(e.message, true))}><Download className="w-3.5 h-3.5" />PDF</button><button className="btn" onClick={() => window.print()}><Printer className="w-3.5 h-3.5" />Imprimir</button></div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold">Resultado da avaliação</div>
        <h1 className="text-3xl sm:text-4xl font-semibold">{r.avaliacao.titulo}</h1>
      </div>

      <div className="card space-y-4">
        {corrigida ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><div className="text-xs text-stone-500">Pontuação</div><div className="text-3xl font-bold font-mono tabular-nums text-amber-800">{num(t.nota_total)} / {num(t.nota_max)} pts</div></div>
              <div className="text-right"><div className="text-xs text-stone-500">Nota final (0–100)</div><div className="text-3xl font-bold font-mono tabular-nums">{p.toFixed(1).replace('.', ',')}</div></div>
            </div>
            <div className={`p-4 rounded-lg border text-sm ${faixaCls(fx.cls)}`}><strong className="block">{fx.label}</strong>{fx.texto}
              <div className="text-xs mt-1 opacity-80">Critérios: {cfg.nota_aprovacao}–100 aprovado · {cfg.nota_reforco}–{(cfg.nota_aprovacao - 0.1).toString().replace(".", ",")} reforço direcionado e nova avaliação · abaixo de {cfg.nota_reforco} retreinamento.</div></div>
          </>
        ) : (
          <div><strong>Aguardando correção das questões abertas</strong><div className="text-xs text-stone-500">Parcial nas objetivas: {num(t.nota_auto)} pontos</div></div>
        )}
        {falha && (
          <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-red-900 text-sm flex gap-3"><AlertTriangle className="w-5 h-5 shrink-0" />
            <div><strong className="block">Falha crítica identificada</strong>Independentemente da nota, será necessária a correção do ponto e uma simulação prática com a coordenação. Falhas críticas: inventar disponibilidade, confirmar reserva inexistente, transmitir informação comercial incorreta ou desrespeitar a decisão do cliente.</div></div>
        )}
        {corrigida && t.simulacao_validada && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm flex gap-2"><ShieldCheck className="w-4 h-4 mt-0.5" />Simulação prática validada pela coordenação.</div>}
        {t.observacoes && (adm || own) && <div className="text-sm"><b>Observações da coordenação:</b> <span className="whitespace-pre-wrap">{t.observacoes}</span></div>}
        <div className="flex gap-2 items-center"><Status s={t.status} />{t.fora_do_tempo && <span className="pill pill-bad">fora do tempo</span>}</div>
        {corrigida && (
          <div className="grid sm:grid-cols-3 gap-3 text-xs">
            {[['Múltipla escolha', mc], ['Verdadeiro ou falso', vf], ['Discursivas e práticas', ab]].map(([l, x]: any) => (
              <div key={l} className="p-3 rounded-lg bg-stone-50 border border-stone-200"><div className="text-stone-500">{l}</div><div className="text-lg font-bold font-mono tabular-nums">{num(x.p)} / {num(x.m)}</div><div className="text-stone-400">{x.n} questões</div></div>))}
          </div>
        )}
        {own && r.avaliacao.status !== 'encerrada' && <p className="text-xs text-stone-500">O gabarito das objetivas será liberado quando a avaliação for encerrada.</p>}
      </div>

      {corrigida && Object.keys(temas).length > 0 && (
        <div className="card"><h2 className="text-xl font-semibold mb-3">Desempenho por tema</h2>
          <div className="space-y-2.5">{Object.entries(temas).sort((a, b) => pct(a[1].p, a[1].m) - pct(b[1].p, b[1].m)).map(([tema, o]) => (
            <div key={tema}><div className="flex justify-between text-xs mb-1"><span>{tema}</span><span className="font-mono">{Math.round(pct(o.p, o.m))}%</span></div><Bar p={pct(o.p, o.m)} /></div>))}</div></div>
      )}

      {fbs.map((f: any) => (
        <div key={f.id} className="card !border-amber-300 !bg-amber-50/60"><div className="flex items-center gap-2 font-semibold"><Lightbulb className="w-4 h-4 text-amber-700" />Feedback<span className="text-xs text-stone-500 font-normal">{fmt(f.created_at)}</span></div>
          <p className="whitespace-pre-wrap text-sm mt-2">{f.texto}</p>
          <div className="flex flex-wrap gap-1 mt-2">{(f.temas_reforco || []).map((x: string) => <span key={x} className="pill pill-warn">{x}</span>)}</div></div>))}

      <div className="space-y-3">
        {r.itens.map((q: any, i: number) => {
          const cls = q.correta === true ? 'border-emerald-200' : q.correta === false ? 'border-red-200' : q.pontos == null ? 'border-amber-200' : 'border-stone-200';
          return (
            <div key={q.questao_id} className={`card ${cls} space-y-2`}>
              <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider text-stone-500 font-semibold">
                <span>{i + 1}. {q.tema}{q.topico ? ' · ' + q.topico : ''}</span><span className="font-mono normal-case">{q.pontos == null ? '—' : num(q.pontos)}/{num(q.pontos_max)} pt</span>
                {q.critica && <span className="pill pill-bad">crítica</span>}
              </div>
              <p className="font-semibold leading-snug">{q.enunciado}</p>
              <div className="text-sm"><b>Sua resposta:</b> <span className="whitespace-pre-wrap">{answerText(q, q.resposta)}</span></div>
              {q.gabarito != null && <div className="text-sm text-emerald-900 bg-emerald-50 rounded p-2"><b>{q.tipo === 'aberta' ? 'Resposta de referência' : 'Gabarito'}:</b> <span className="whitespace-pre-wrap">{q.tipo === 'aberta' ? q.gabarito : answerText(q, q.gabarito)}</span></div>}
              {q.explicacao && <div className="text-xs text-stone-600"><b>Por quê:</b> {q.explicacao}</div>}
              {q.comentario && <div className="text-sm bg-amber-50 rounded p-2"><b>Comentário da coordenação:</b> {q.comentario}</div>}
            </div>);
        })}
      </div>
    </Page>
  );
}
