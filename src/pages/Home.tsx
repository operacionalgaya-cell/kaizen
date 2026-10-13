import React from 'react';
import { ArrowRight, BookOpen, FileText, Bell, Sparkles, ClipboardList } from 'lucide-react';
import { sb } from '../lib/supabase';
import { useApp, useAsync, run, go } from '../lib/app';
import { Loading, ErrorBox, Page, Status, Empty } from '../lib/ui';
import { fmt, num, pct, faixa, faixaCls } from '../lib/util';

export function Home() {
  const { me, cfg, toast, reloadMe } = useApp();
  const { data, err, loading } = useAsync(async () => {
    const [avs, tents, fbs, kz] = await Promise.all([
      run(sb.from('avaliacoes').select('*').neq('status', 'rascunho').order('created_at', { ascending: false })),
      run(sb.from('tentativas').select('*').eq('user_id', me!.id)),
      run(sb.from('feedbacks').select('*').eq('user_id', me!.id).order('created_at', { ascending: false }).limit(5)),
      run(sb.from('kaizen_registros').select('id,feedback_em,lido').eq('user_id', me!.id)),
    ]);
    return { avs, tents, fbs, kz };
  }, []);
  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;
  const { avs, tents, fbs, kz } = data!;
  const tmap: any = Object.fromEntries(tents.map((t: any) => [t.avaliacao_id, t]));
  const amap: any = Object.fromEntries(avs.map((a: any) => [a.id, a]));
  const pend = avs.filter((a: any) => a.status === 'publicada' && (!tmap[a.id] || tmap[a.id].status === 'em_andamento'));
  const done = tents.filter((t: any) => t.status !== 'em_andamento').sort((a: any, b: any) => +new Date(b.enviada_em) - +new Date(a.enviada_em));
  const last = done.find((t: any) => t.status === 'corrigida');
  const lastP = last ? pct(last.nota_total, last.nota_max) : null;
  const fx = lastP != null ? faixa(lastP, cfg.nota_aprovacao, cfg.nota_reforco) : null;
  const kzNovos = kz.filter((r: any) => r.feedback_em && !r.lido).length;

  const iniciar = async (id: string) => {
    try { const tid = await run(sb.rpc('iniciar_tentativa', { p_avaliacao: id })); go('/prova/' + tid); } catch (e: any) { toast(e.message, true); }
  };
  const setUnidade = async (u: string) => { try { await run(sb.rpc('definir_minha_unidade', { p_unidade: u })); await reloadMe(); toast('Unidade atualizada'); } catch (e: any) { toast(e.message, true); } };

  return (
    <Page>
      <div className="bg-stone-900 text-stone-100 rounded-xl p-6 sm:p-8 border border-stone-800 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs text-amber-300 font-semibold tracking-wide uppercase">
          <span>Portal da Consultora Gaya</span>
          {cfg.unidades.length > 0 ? (
            <><span className="text-stone-600">·</span>
              <select aria-label="Unidade" className="bg-transparent text-amber-300 text-xs uppercase font-semibold focus:outline-none" value={me!.unidade || ''} onChange={(e) => setUnidade(e.target.value)}>
                <option value="" className="text-stone-900">Escolha sua unidade</option>
                {cfg.unidades.map((u) => <option key={u} className="text-stone-900">{u}</option>)}
              </select></>
          ) : me!.unidade ? <><span className="text-stone-600">·</span><span>{me!.unidade}</span></> : null}
        </div>
        <h1 className="text-3xl sm:text-4xl font-medium text-white">Olá, {(me!.nome || '').split(' ')[0] || 'Consultora'}!</h1>
        <p className="text-stone-300 text-sm max-w-2xl leading-relaxed">Este é o seu espaço de aprendizado contínuo: suas avaliações, o playbook do Jeito Gaya e o retorno do Kaizen sobre os seus atendimentos.</p>
        <div className="pt-1 flex flex-wrap gap-2">
          <a href="#/kaizen/novo" className="btn-dark"><ClipboardList className="w-3.5 h-3.5" />Registrar oportunidade perdida</a>
          <a href="#/playbook" className="btn !bg-stone-800 !text-stone-200 !border-stone-700 hover:!bg-stone-700"><BookOpen className="w-3.5 h-3.5 text-amber-300" />Ver o Playbook</a>
          {kzNovos > 0 && <a href="#/kaizen" className="btn !bg-amber-100 !text-amber-900 !border-amber-200"><Sparkles className="w-3.5 h-3.5" />{kzNovos} feedback(s) Kaizen novo(s)</a>}
        </div>
      </div>

      {fx && last && (
        <div className={`rounded-xl border p-4 flex flex-wrap items-center gap-4 ${faixaCls(fx.cls)}`}>
          <div className="w-14 h-14 rounded-full bg-white/70 border flex items-center justify-center font-bold font-mono text-sm tabular-nums">{Math.round(lastP!)}%</div>
          <div className="flex-1 min-w-48">
            <strong className="block">{fx.label} · última avaliação</strong>
            <span className="text-xs">{fx.texto}{last.falha_critica ? ' Houve falha crítica: correção e simulação prática serão combinadas com a coordenação.' : ''}</span>
          </div>
          <a href={'#/resultado/' + last.id} className="text-xs font-semibold underline">Ver detalhes</a>
        </div>
      )}

      <section>
        <h2 className="text-2xl font-semibold mb-3">Avaliações pendentes</h2>
        {pend.length ? <div className="space-y-3">{pend.map((a: any) => {
          const late = a.prazo && new Date(a.prazo) < new Date(); const t = tmap[a.id];
          return (
            <div key={a.id} className="card flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-xl font-semibold">{a.titulo}</h3>
                <div className="text-xs text-stone-500">{a.mes ? a.mes + ' · ' : ''}prazo: {fmt(a.prazo)}{a.tempo_limite_min ? ` · ${a.tempo_limite_min} min` : ''}</div>
                {a.descricao && <p className="text-sm text-stone-600 mt-1">{a.descricao}</p>}
              </div>
              {late ? <span className="pill pill-bad">prazo encerrado</span> : <button className="btn-pri" onClick={() => iniciar(a.id)}><FileText className="w-3.5 h-3.5" />{t ? 'Continuar' : 'Iniciar avaliação'}</button>}
            </div>);
        })}</div> : <Empty text="Nenhuma avaliação pendente no momento." />}
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-3">Meu histórico</h2>
        {done.length ? (
          <div className="card !p-0 overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Avaliação</th><th className="th">Enviada</th><th className="th">Nota</th><th className="th" /></tr></thead><tbody>
            {done.map((t: any) => { const p = pct(t.nota_total, t.nota_max); return (
              <tr key={t.id}><td className="td">{amap[t.avaliacao_id]?.titulo || '—'}</td><td className="td">{fmt(t.enviada_em)}</td>
                <td className="td">{t.status === 'corrigida' ? <>{num(t.nota_total)}/{num(t.nota_max)} <span className="text-stone-500">({Math.round(p)}%)</span></> : <Status s={t.status} />}</td>
                <td className="td text-right"><a className="btn" href={'#/resultado/' + t.id}>Ver <ArrowRight className="w-3 h-3" /></a></td></tr>); })}
          </tbody></table></div>
        ) : <Empty text="Você ainda não concluiu nenhuma avaliação." />}
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-3">Feedbacks da coordenação</h2>
        {fbs.length ? <div className="space-y-3">{fbs.map((f: any) => (
          <div key={f.id} className={`card ${f.lido ? '' : '!border-amber-300 !bg-amber-50/60'}`}>
            <div className="text-xs text-stone-500 font-mono">{fmt(f.created_at)}</div>
            <p className="whitespace-pre-wrap text-sm mt-1">{f.texto}</p>
            <div className="flex flex-wrap gap-1 mt-2">{(f.temas_reforco || []).map((t: string) => <span key={t} className="pill pill-warn">{t}</span>)}</div>
            {f.tentativa_id && <a href={'#/resultado/' + f.tentativa_id} className="text-xs font-semibold text-amber-800 underline mt-2 inline-block">Ver avaliação</a>}
          </div>))}</div> : <Empty text="Sem feedbacks por enquanto." />}
      </section>
    </Page>
  );
}
