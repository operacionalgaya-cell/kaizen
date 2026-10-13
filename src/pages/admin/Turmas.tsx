import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { sb } from '../../lib/supabase';
import { useApp, useAsync, run } from '../../lib/app';
import { Loading, ErrorBox, Page, Modal, Empty, Field } from '../../lib/ui';

export function Turmas() {
  const { toast } = useApp();
  const { data, err, loading, reload } = useAsync(async () => {
    const [turmas, tm, profs] = await Promise.all([run(sb.from('turmas').select('*').order('nome')), run(sb.from('turma_membros').select('*')), run(sb.from('profiles').select('id,nome,email').eq('ativo', true).order('nome'))]);
    return { turmas, tm, profs };
  }, []);
  const [edit, setEdit] = useState<any>(null);
  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;
  const { turmas, tm, profs } = data!;
  const del = async (t: any) => { if (!confirm(`Excluir a turma "${t.nome}"?`)) return; try { await run(sb.from('turmas').delete().eq('id', t.id)); reload(); } catch (e: any) { toast(e.message, true); } };
  return (
    <Page title="Turmas" subtitle="Grupos que recebem as avaliações" actions={<button className="btn-pri" onClick={() => setEdit({ nome: '', descricao: '', membros: [] })}><Plus className="w-3.5 h-3.5" />Nova turma</button>}>
      {turmas.length ? <div className="grid sm:grid-cols-2 gap-3">{turmas.map((t: any) => {
        const ms = tm.filter((m: any) => m.turma_id === t.id).map((m: any) => m.user_id);
        return (<div key={t.id} className="card"><h3 className="text-xl font-semibold">{t.nome}</h3><p className="text-xs text-stone-500">{t.descricao}</p>
          <p className="text-sm mt-2">{ms.length ? ms.map((id: string) => profs.find((p: any) => p.id === id)?.nome || '—').join(', ') : <span className="text-stone-400">Sem membros</span>}</p>
          <div className="flex gap-2 mt-3"><button className="btn" onClick={() => setEdit({ ...t, membros: ms })}>Editar</button><button className="btn-dan" onClick={() => del(t)}>Excluir</button></div></div>);
      })}</div> : <Empty text="Nenhuma turma. Crie a primeira para poder publicar avaliações." />}
      {edit && <TurmaModal t={edit} profs={profs} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </Page>
  );
}
function TurmaModal({ t, profs, onClose, onSaved }: any) {
  const { toast } = useApp();
  const [f, setF] = useState({ nome: t.nome, descricao: t.descricao || '' });
  const [sel, setSel] = useState<Set<string>>(new Set(t.membros));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let id = t.id;
      if (id) await run(sb.from('turmas').update({ nome: f.nome.trim(), descricao: f.descricao.trim() || null }).eq('id', id));
      else id = (await run(sb.from('turmas').insert({ nome: f.nome.trim(), descricao: f.descricao.trim() || null }).select('id').single())).id;
      await run(sb.from('turma_membros').delete().eq('turma_id', id));
      if (sel.size) await run(sb.from('turma_membros').insert([...sel].map((user_id) => ({ turma_id: id, user_id }))));
      toast('Turma salva'); onSaved();
    } catch (err: any) { toast(err.message, true); }
  };
  return (
    <Modal title={t.id ? 'Editar turma' : 'Nova turma'} onClose={onClose}>
      <form onSubmit={save}>
        <Field label="Nome"><input className="inp" required value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
        <Field label="Descrição"><input className="inp" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Field>
        <label className="lbl">Membros</label>
        <div className="max-h-64 overflow-auto border border-stone-200 rounded-md divide-y divide-stone-100">{profs.map((p: any) => (
          <label key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-stone-50"><input type="checkbox" className="accent-amber-700" checked={sel.has(p.id)} onChange={() => toggle(p.id)} />{p.nome || p.email}<span className="text-xs text-stone-400">{p.email}</span></label>))}</div>
        <div className="flex gap-2 mt-5"><button className="btn-pri">Salvar</button><button type="button" className="btn" onClick={onClose}>Cancelar</button></div>
      </form>
    </Modal>
  );
}
