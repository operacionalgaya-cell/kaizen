import React from 'react';
import { ArrowLeft, Download, FileSpreadsheet } from 'lucide-react';
import { sb } from '../../lib/supabase';
import { useApp, useAsync, run } from '../../lib/app';
import { Loading, ErrorBox, Page, Kpi, Bar, Status, Empty } from '../../lib/ui';
import { fmt, num, pct, csv, pdf, slug } from '../../lib/util';
import { exportResultadoPdf } from '../Resultado';
import { FeedbackModal } from './Feedback';

export function Equipe() {
  const { me, toast } = useApp();
  const { data, err, loading, reload } = useAsync(async () => {
    const [profs, tents] = await Promise.all([run(sb.from('profiles').select('*').order('nome')), run(sb.from('tentativas').select('user_id,nota_total,nota_max,status,enviada_em').eq('status', 'corrigida').order('enviada_em').range(0, 4999))]);
    return { profs, tents };
  }, []);
  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;
  const { profs, tents } = data!;
  const stat = (id: string) => { const t = tents.filter((x: any) => x.user_id === id); return { n: t.length, med: t.length ? t.reduce((s: number, x: any) => s + pct(x.nota_total, x.nota_max), 0) / t.length : null, ult: t.length ? pct(t[t.length - 1].nota_total, t[t.length - 1].nota_max) : null }; };
  const upd = async (id: string, patch: any, ok: string) => { try { await run(sb.from('profiles').update(patch).eq('id', id)); toast(ok); reload(); } catch (e: any) { toast(e.message, true); } };
  const pend = profs.filter((p: any) => !p.ativo);
  const ativos = profs.filter((p: any) => p.ativo);
  const rows = () => ativos.filter((p: any) => p.role === 'colaborador').map((p: any) => { const s = stat(p.id); return [p.nome || p.email, p.email, p.unidade || '', s.n, s.med == null ? '—' : Math.round(s.med), s.ult == null ? '—' : Math.round(s.ult)]; });
  return (
    <Page title="Equipe" subtitle="Aprovação de acessos e relatórios por pessoa" wide actions={<>
      <button className="btn" onClick={() => pdf('Kaizen — Desempenho da equipe', `Gerado em ${fmt(new Date())}`, ['Colaborador', 'Unidade', 'Provas', 'Média %', 'Última %'], rows().map((r) => [r[0], r[2], r[3], r[4], r[5]]), 'kaizen-equipe.pdf')}><Download className="w-3.5 h-3.5" />PDF</button>
      <button className="btn" onClick={() => csv('kaizen-equipe.csv', [['Colaborador', 'E-mail', 'Unidade', 'Provas', 'Média %', 'Última %'], ...rows()])}><FileSpreadsheet className="w-3.5 h-3.5" />CSV</button></>}>
      {pend.length > 0 && <section><h2 className="text-xl font-semibold mb-2">Aguardando aprovação</h2><div className="space-y-2">{pend.map((p: any) => (
        <div key={p.id} className="card !p-4 !border-amber-300 !bg-amber-50/60 flex flex-wrap items-center justify-between gap-2"><div><b>{p.nome || '—'}</b><div className="text-xs text-stone-500">{p.email}</div></div><button className="btn-pri" onClick={() => upd(p.id, { ativo: true }, 'Acesso aprovado')}>Aprovar</button></div>))}</div></section>}
      <section><h2 className="text-xl font-semibold mb-2">Membros</h2><div className="card !p-0 overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Nome</th><th className="th">Perfil</th><th className="th">Unidade</th><th className="th">Provas</th><th className="th">Média</th><th className="th" /></tr></thead><tbody>
        {ativos.map((p: any) => { const s = stat(p.id); return (
          <tr key={p.id}><td className="td"><a className="font-semibold text-amber-900 hover:underline" href={'#/admin/colab/' + p.id}>{p.nome || p.email}</a><div className="text-xs text-stone-500">{p.email}</div></td>
            <td className="td"><select className="inp !w-auto !py-1" disabled={p.id === me!.id} value={p.role} onChange={(e) => upd(p.id, { role: e.target.value }, 'Perfil atualizado')}><option value="colaborador">Colaborador</option><option value="admin">Admin</option></select></td>
            <td className="td text-xs">{p.unidade || '—'}</td><td className="td">{s.n}</td>
            <td className="td w-40">{s.med == null ? '—' : <><span className="text-xs font-mono">{Math.round(s.med)}%</span><Bar p={s.med} /></>}</td>
            <td className="td text-right">{p.id !== me!.id && <button className="btn-dan" onClick={() => confirm('Desativar o acesso desta pessoa?') && upd(p.id, { ativo: false }, 'Acesso desativado')}>Desativar</button>}</td></tr>); })}</tbody></table></div></section>
    </Page>
  );
}

export function Colab({ id }: { id: string }) {
  const { cfg, toast } = useApp();
  const { data, err, loading } = useAsync(async () => {
    const [prof, tents, temas, fbs, kz] = await Promise.all([
      run(sb.from('profiles').select('*').eq('id', id).single()),
      run(sb.from('tentativas').select('*,avaliacoes(titulo,mes)').eq('user_id', id).neq('status', 'em_andamento').order('enviada_em')),
      run(sb.from('v_desempenho_user_tema').select('*').eq('user_id', id)),
      run(sb.from('feedbacks').select('*').eq('user_id', id).order('created_at', { ascending: false })),
      run(sb.from('kaizen_registros').select('id,categoria,etapa,status,created_at,feedback_em').eq('user_id', id).order('created_at', { ascending: false })),
    ]);
    return { prof, tents, temas, fbs, kz };
  }, [id]);
  const [fb, setFb] = React.useState<string | null>(null);
  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;
  const { prof, tents, temas, fbs, kz } = data!;
  const corr = tents.filter((t: any) => t.status === 'corrigida');
  const med = corr.length ? corr.reduce((s: number, t: any) => s + pct(t.nota_total, t.nota_max), 0) / corr.length : 0;
  const ult = corr.length ? pct(corr[corr.length - 1].nota_total, corr[corr.length - 1].nota_max) : 0;
  const ant = corr.length > 1 ? pct(corr[corr.length - 2].nota_total, corr[corr.length - 2].nota_max) : null;
  const delta = ant == null ? '' : ult - ant >= 0 ? `▲ ${(ult - ant).toFixed(1)} pp` : `▼ ${Math.abs(ult - ant).toFixed(1)} pp`;
  const nome = prof.nome || prof.email;
  const tRows = [...temas].sort((a: any, b: any) => pct(a.pontos, a.pontos_max) - pct(b.pontos, b.pontos_max));
  const tabela = () => tents.map((t: any) => [t.avaliacoes?.titulo, t.avaliacoes?.mes || '', t.status === 'corrigida' ? `${num(t.nota_total)}/${num(t.nota_max)}` : '—', t.status === 'corrigida' ? Math.round(pct(t.nota_total, t.nota_max)) + '%' : '—', t.falha_critica ? 'sim' : '', t.status]);
  return (
    <Page wide title={nome} subtitle={`${prof.email}${prof.unidade ? ' · ' + prof.unidade : ''}`} actions={<>
      <button className="btn" onClick={() => pdf(`Kaizen — Relatório de ${nome}`, `Gerado em ${fmt(new Date())}`, ['Avaliação', 'Mês', 'Pontos', 'Nota', 'Falha crítica', 'Status'], tabela(), `kaizen-relatorio-${slug(nome)}.pdf`)}><Download className="w-3.5 h-3.5" />PDF</button>
      <button className="btn" onClick={() => csv(`kaizen-${slug(nome)}.csv`, [['Avaliação', 'Mês', 'Pontos', 'Nota', 'Falha crítica', 'Status'], ...tabela()])}><FileSpreadsheet className="w-3.5 h-3.5" />CSV</button></>}>
      <a href="#/admin/equipe" className="text-xs text-stone-500 inline-flex items-center gap-1"><ArrowLeft className="w-3 h-3" />Equipe</a>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><Kpi v={corr.length} l="avaliações corrigidas" /><Kpi v={`${Math.round(med)}%`} l="média" /><Kpi v={`${Math.round(ult)}%`} l={`última ${delta}`} /><Kpi v={kz.length} l="registros Kaizen" /></div>
      <p className="text-xs text-stone-500">Lembrete: a nota não deve ser usada isoladamente para decisões disciplinares ou de remuneração.</p>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card"><h2 className="text-xl font-semibold mb-3">Desempenho por tema</h2>{tRows.length ? <div className="space-y-2.5">{tRows.map((x: any) => { const p = pct(x.pontos, x.pontos_max); return <div key={x.tema}><div className="flex justify-between text-xs mb-1"><span>{x.tema}</span><span className="font-mono">{Math.round(p)}%</span></div><Bar p={p} /></div>; })}</div> : <Empty text="Sem dados." />}</div>
        <div className="card"><h2 className="text-xl font-semibold mb-3">Feedbacks enviados</h2>{fbs.length ? <div className="space-y-3">{fbs.slice(0, 5).map((f: any) => <p key={f.id} className="text-sm"><span className="text-xs text-stone-500 font-mono">{fmt(f.created_at)} · {f.lido ? 'lido' : 'não lido'}</span><br />{f.texto.slice(0, 180)}…</p>)}</div> : <Empty text="Nenhum ainda." />}</div>
      </div>
      <div className="card !p-0 overflow-x-auto"><h2 className="text-xl font-semibold p-4 pb-2">Histórico de avaliações</h2><table className="w-full"><thead><tr><th className="th">Avaliação</th><th className="th">Mês</th><th className="th">Nota</th><th className="th">Status</th><th className="th" /></tr></thead><tbody>
        {tents.map((t: any) => <tr key={t.id}><td className="td">{t.avaliacoes?.titulo}</td><td className="td text-xs">{t.avaliacoes?.mes}</td><td className="td">{t.status === 'corrigida' ? <>{num(t.nota_total)}/{num(t.nota_max)} <span className="text-stone-400">({Math.round(pct(t.nota_total, t.nota_max))}%)</span>{t.falha_critica && <span className="pill pill-bad ml-1">crítica</span>}</> : '—'}</td><td className="td"><Status s={t.status} /></td>
          <td className="td text-right whitespace-nowrap"><a className="btn" href={'#/resultado/' + t.id}>Detalhe</a> <button className="btn" onClick={() => exportResultadoPdf(t.id).catch((e) => toast(e.message, true))}>PDF</button> {t.status === 'corrigida' ? <button className="btn" onClick={() => setFb(t.id)}>Feedback</button> : <a className="btn-pri" href={'#/admin/corrigir/' + t.id}>Corrigir</a>}</td></tr>)}</tbody></table></div>
      {fb && <FeedbackModal tid={fb} onClose={() => setFb(null)} />}
    </Page>
  );
}
