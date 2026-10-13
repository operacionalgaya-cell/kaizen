import React from 'react';
import { AlertTriangle, BookOpen, ShieldCheck } from 'lucide-react';
import { Page } from '../lib/ui';
import * as P from '../data/playbook';
import { useApp } from '../lib/app';

export function Playbook() {
  const { cfg } = useApp();
  return (
    <Page title="Jeito Gaya de Encantar e Vender" subtitle="Playbook de consulta rápida, baseado no Documento Executivo (Out/2026).">
      <section className="card"><h2 className="text-2xl font-semibold mb-3">Princípios</h2>
        <div className="grid sm:grid-cols-2 gap-3">{P.PRINCIPIOS.map(([t, d]) => <div key={t} className="p-3 rounded-lg bg-stone-50 border border-stone-200"><div className="font-semibold text-sm text-amber-900">{t}</div><p className="text-sm text-stone-600">{d}</p></div>)}</div></section>

      <section className="card"><h2 className="text-2xl font-semibold mb-3">As seis etapas da venda receptiva</h2>
        <ol className="space-y-3">{P.ETAPAS.map((e) => (
          <li key={e.n} className="flex gap-4"><div className="w-9 h-9 shrink-0 rounded-full bg-stone-900 text-amber-200 font-serif-display text-xl flex items-center justify-center">{e.n}</div>
            <div><div className="font-semibold">{e.t}</div><p className="text-sm text-stone-600"><b>Objetivo:</b> {e.o}</p><p className="text-sm text-stone-600"><b>Critério de conclusão:</b> {e.c}</p></div></li>))}</ol></section>

      <section className="card"><h2 className="text-2xl font-semibold mb-1">Qualificação consultiva adaptativa</h2>
        <p className="text-sm text-stone-600 mb-3">Não é uma sequência fixa de perguntas: combina venda consultiva com a adaptação ao que a pessoa já disse. Os perfis são dinâmicos; a categoria escolhida no chatbot não é uma escolha definitiva de serviço — considere a mensagem original e o histórico integral.</p>
        <div className="grid md:grid-cols-3 gap-3">{P.PERFIS.map((x) => (
          <div key={x.p} className="p-4 rounded-lg border border-stone-200 bg-stone-50"><div className="font-serif-display text-3xl text-amber-800">{x.p}</div><div className="font-semibold text-sm">{x.t}</div>
            <p className="text-xs text-stone-500 mt-1"><b>Sinal típico:</b> {x.s}</p><p className="text-xs text-stone-700 mt-1"><b>Conduta:</b> {x.c}</p></div>))}</div>
        <h3 className="text-xl font-semibold mt-5 mb-2">Quatro camadas</h3>
        <ol className="grid sm:grid-cols-2 gap-3">{P.CAMADAS.map(([t, d], i) => <li key={t} className="p-3 rounded-lg bg-amber-50/60 border border-amber-200 text-sm"><b>{i + 1}. {t}:</b> {d}</li>)}</ol></section>

      <section className="card"><h2 className="text-2xl font-semibold mb-3">Padrões de condução</h2>
        <div className="space-y-3">{P.CONDUTAS.map(([t, d]) => <div key={t}><div className="font-semibold text-sm">{t}</div><p className="text-sm text-stone-600">{d}</p></div>)}</div></section>

      <section className="card"><h2 className="text-2xl font-semibold mb-1">Kaizen Gaya: ciclo de melhoria contínua</h2>
        <p className="text-sm text-stone-600 mb-3">Toda oportunidade efetivamente perdida deve ser registrada, com o histórico da conversa. O objetivo é qualidade e consistência — não burocracia nem punição.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">{P.CICLO.map(([t, d]) => <div key={t} className="p-3 rounded-lg bg-stone-50 border border-stone-200"><b className="text-sm">{t}</b><p className="text-sm text-stone-600">{d}</p></div>)}</div>
        <h3 className="text-xl font-semibold mt-5 mb-2">Formato-padrão do feedback</h3>
        <ul className="list-disc pl-5 text-sm space-y-0.5">{P.FEEDBACK_FORMATO.map(([, l]) => <li key={l}>{l}</li>)}</ul>
        <a href="#/kaizen/novo" className="btn-pri mt-4"><BookOpen className="w-3.5 h-3.5" />Registrar uma oportunidade perdida</a></section>

      <section className="card"><h2 className="text-2xl font-semibold mb-3">Como a avaliação funciona</h2>
        <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Componente</th><th className="th">Quantidade</th><th className="th">Pontuação</th></tr></thead><tbody>{P.PROVA_ESTRUTURA.map((r) => <tr key={r[0]}>{r.map((c, i) => <td key={i} className="td">{c}</td>)}</tr>)}</tbody></table></div>
        <ul className="text-sm mt-3 space-y-1">
          <li><span className="pill pill-ok">{cfg.nota_aprovacao}–100</span> aprovada</li>
          <li><span className="pill pill-warn">{cfg.nota_reforco}–{(cfg.nota_aprovacao - 0.1).toString().replace(".", ",")}</span> reforço direcionado e nova avaliação</li>
          <li><span className="pill pill-bad">abaixo de {cfg.nota_reforco}</span> retreinamento antes da nova tentativa</li></ul>
        <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-900 flex gap-3"><AlertTriangle className="w-5 h-5 shrink-0" />
          <div><b>Falha crítica</b> exige correção e simulação prática, independentemente da nota: {P.FALHAS_CRITICAS.map((f) => f.toLowerCase()).join('; ')}.</div></div>
        <p className="text-sm text-stone-600 mt-3 flex gap-2"><ShieldCheck className="w-4 h-4 mt-0.5 text-emerald-700" />A nota não é utilizada isoladamente para decisões disciplinares ou de remuneração. A avaliação é formativa: serve para identificar reforços.</p></section>

      <section className="card"><h2 className="text-2xl font-semibold mb-3">Indicadores acompanhados pela gestão</h2>
        <div className="space-y-2">{P.INDICADORES.map(([t, d]) => <div key={t} className="text-sm"><b>{t}:</b> <span className="text-stone-600">{d}</span></div>)}</div>
        <h3 className="text-xl font-semibold mt-5 mb-2">Princípios de qualidade e governança</h3>
        <ul className="list-disc pl-5 text-sm text-stone-600 space-y-1">{P.GOVERNANCA.map((g) => <li key={g}>{g}</li>)}</ul></section>
    </Page>
  );
}
