import React, { useState } from 'react';
import { sb } from '../../lib/supabase';
import { useApp, run } from '../../lib/app';
import { Page, Field } from '../../lib/ui';
import * as P from '../../data/playbook';

export function Config() {
  const { cfg, reloadCfg, toast } = useApp();
  const [f, setF] = useState({ a: cfg.nota_aprovacao, r: cfg.nota_reforco, u: cfg.unidades.join('\n') });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (Number(f.r) >= Number(f.a)) throw new Error('A nota de reforço deve ser menor que a de aprovação');
      await run(sb.from('configuracoes').update({ nota_aprovacao: Number(f.a), nota_reforco: Number(f.r), unidades: f.u.split('\n').map((s) => s.trim()).filter(Boolean), updated_at: new Date().toISOString() }).eq('id', true));
      await reloadCfg(); toast('Ajustes salvos');
    } catch (er: any) { toast(er.message, true); }
  };
  return (
    <Page title="Ajustes" subtitle="Critérios de avaliação e unidades">
      <form onSubmit={save} className="card">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Nota mínima para aprovação (%)"><input className="inp" type="number" min="1" max="100" value={f.a} onChange={(e) => setF({ ...f, a: e.target.value as any })} /></Field>
          <Field label="Nota mínima para reforço direcionado (%)"><input className="inp" type="number" min="1" max="100" value={f.r} onChange={(e) => setF({ ...f, r: e.target.value as any })} /></Field>
        </div>
        <p className="text-xs text-stone-500 mt-2">Padrão do Documento Executivo: 85–100 aprovada; 70–84,9 reforço direcionado e nova avaliação; abaixo de 70 retreinamento. Falha crítica sempre exige correção e simulação prática.</p>
        <Field label="Unidades (uma por linha — a consultora escolhe a dela no painel)"><textarea className="inp min-h-24" value={f.u} onChange={(e) => setF({ ...f, u: e.target.value })} placeholder={'Ex.:\nJuvevê\nPKB'} /></Field>
        <button className="btn-pri mt-4">Salvar ajustes</button>
      </form>
      <div className="card"><h2 className="text-xl font-semibold mb-2">Ritual de gestão sugerido</h2>
        <ul className="text-sm space-y-1">{P.RITUAL.map(([t, d]) => <li key={t}><b>{t}:</b> <span className="text-stone-600">{d}</span></li>)}</ul></div>
    </Page>
  );
}
