import React, { useMemo, useRef, useState } from 'react';
import { Download, Plus, Upload, AlertTriangle } from 'lucide-react';
import { sb } from '../../lib/supabase';
import { useApp, useAsync, run } from '../../lib/app';
import { Loading, ErrorBox, Page, Modal, Empty, Field } from '../../lib/ui';
import { download, letter } from '../../lib/util';

const TIPOS: any = { multipla: 'Múltipla escolha', vf: 'Verdadeiro/Falso', aberta: 'Aberta' };

export function Questoes() {
  const { toast } = useApp();
  const { data, err, loading, reload } = useAsync(() => run(sb.from('questoes').select('*').order('created_at').range(0, 1999)), []);
  const [fil, setFil] = useState({ tipo: '', tema: '', q: '' });
  const [edit, setEdit] = useState<any>(null);
  const file = useRef<HTMLInputElement>(null);
  const temas = useMemo(() => [...new Set((data || []).map((q: any) => q.tema))].sort(), [data]);
  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;
  const list = data!.filter((q: any) => (!fil.tipo || q.tipo === fil.tipo) && (!fil.tema || q.tema === fil.tema) && (!fil.q || (q.enunciado + (q.topico || '')).toLowerCase().includes(fil.q.toLowerCase())));
  const del = async (q: any) => {
    if (!confirm('Excluir esta questão? Se já foi usada em avaliações, prefira desativá-la.')) return;
    const { error } = await sb.from('questoes').delete().eq('id', q.id);
    if (error) return toast('Não foi possível excluir (questão em uso). Desative-a ao editar.', true);
    reload();
  };
  const imp = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
    try {
      const j = JSON.parse(await f.text()); const arr = Array.isArray(j) ? j : j.questoes;
      if (!Array.isArray(arr) || !arr.length) throw new Error('Arquivo sem questões');
      const clean = arr.map(({ id, created_at, _info, ...q }: any) => q);
      if (!confirm(`Importar ${clean.length} questão(ões)?`)) return;
      for (let i = 0; i < clean.length; i += 50) await run(sb.from('questoes').insert(clean.slice(i, i + 50)));
      toast(`${clean.length} questões importadas`); reload();
    } catch (er: any) { toast('Falha ao importar: ' + er.message, true); }
  };
  const exp = () => download('kaizen-questoes.json', JSON.stringify({ questoes: data!.map(({ id, created_at, ...q }: any) => q) }, null, 2), 'application/json');
  return (
    <Page title="Banco de questões" subtitle={`${data!.length} questões · gabarito visível só para administradores`} wide
      actions={<><input ref={file} type="file" accept="application/json" hidden onChange={imp} />
        <button className="btn" onClick={() => file.current?.click()}><Upload className="w-3.5 h-3.5" />Importar JSON</button>
        <button className="btn" onClick={exp}><Download className="w-3.5 h-3.5" />Exportar</button>
        <button className="btn-pri" onClick={() => setEdit({})}><Plus className="w-3.5 h-3.5" />Nova questão</button></>}>
      <div className="flex flex-wrap gap-2">
        <select className="inp !w-auto" value={fil.tipo} onChange={(e) => setFil({ ...fil, tipo: e.target.value })}><option value="">Todos os tipos</option>{Object.entries(TIPOS).map(([k, v]: any) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="inp !w-auto" value={fil.tema} onChange={(e) => setFil({ ...fil, tema: e.target.value })}><option value="">Todos os temas</option>{temas.map((t: any) => <option key={t}>{t}</option>)}</select>
        <input className="inp !w-64" placeholder="Buscar no enunciado…" value={fil.q} onChange={(e) => setFil({ ...fil, q: e.target.value })} />
      </div>
      {list.length ? <div className="card !p-0 overflow-x-auto"><table className="w-full"><thead><tr><th className="th">Tipo</th><th className="th">Tema</th><th className="th">Enunciado</th><th className="th">Pts</th><th className="th" /></tr></thead><tbody>
        {list.map((q: any) => (
          <tr key={q.id} className={q.ativa ? '' : 'opacity-50'}>
            <td className="td whitespace-nowrap"><span className="pill">{TIPOS[q.tipo]}</span></td>
            <td className="td text-xs">{q.tema}{q.topico && <div className="text-stone-400">{q.topico}</div>}</td>
            <td className="td max-w-xl">{q.enunciado}{q.critica && <span className="pill pill-bad ml-2"><AlertTriangle className="w-3 h-3 mr-1" />crítica</span>}</td>
            <td className="td font-mono">{q.pontos}</td>
            <td className="td whitespace-nowrap text-right"><button className="btn" onClick={() => setEdit(q)}>Editar</button> <button className="btn-dan" onClick={() => del(q)}>Excluir</button></td>
          </tr>))}</tbody></table></div> : <Empty text="Nenhuma questão. Use “Importar JSON” com o arquivo do Anexo A." />}
      {edit && <QuestaoModal q={edit} temas={temas} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
    </Page>
  );
}

function QuestaoModal({ q, temas, onClose, onSaved }: any) {
  const { toast } = useApp();
  const [f, setF] = useState<any>({
    tipo: q.tipo || 'multipla', tema: q.tema || '', topico: q.topico || '', enunciado: q.enunciado || '', opcoes: (q.opcoes || ['', '', '', '']).join('\n'),
    gabarito: q.gabarito || '', explicacao: q.explicacao || '', rubrica: q.rubrica || '', elementos: (q.elementos_chave || []).join('\n'),
    c0: q.criterios?.['0'] || '', c1: q.criterios?.['1'] || '', c2: q.criterios?.['2'] || '', c3: q.criterios?.['3'] || '',
    aviso_critico: q.aviso_critico || '', pontos: q.pontos ?? 1, critica: !!q.critica, ativa: q.ativa ?? true,
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const opts = f.opcoes.split('\n').map((s: string) => s.trim()).filter(Boolean);
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const aberta = f.tipo === 'aberta';
      if (f.tipo === 'multipla' && opts.length < 2) throw new Error('Informe ao menos 2 alternativas (uma por linha)');
      if (!aberta && !f.gabarito.trim()) throw new Error('Informe o gabarito');
      const row: any = {
        tipo: f.tipo, tema: f.tema.trim() || 'Geral', topico: f.topico.trim() || null, enunciado: f.enunciado.trim(),
        opcoes: f.tipo === 'multipla' ? opts : null, gabarito: f.gabarito.trim() || null, explicacao: f.explicacao.trim() || null,
        rubrica: f.rubrica.trim() || null, elementos_chave: aberta ? f.elementos.split('\n').map((s: string) => s.trim()).filter(Boolean) : null,
        criterios: aberta && (f.c0 || f.c1 || f.c2 || f.c3) ? { '0': f.c0, '1': f.c1, '2': f.c2, '3': f.c3 } : null,
        aviso_critico: f.aviso_critico.trim() || null, pontos: Number(f.pontos) || 1, critica: f.critica, ativa: f.ativa,
      };
      if (q.id) await run(sb.from('questoes').update(row).eq('id', q.id)); else await run(sb.from('questoes').insert(row));
      toast('Questão salva'); onSaved();
    } catch (er: any) { toast(er.message, true); }
  };
  return (
    <Modal title={q.id ? 'Editar questão' : 'Nova questão'} onClose={onClose} wide>
      <form onSubmit={save}>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Tipo"><select className="inp" value={f.tipo} onChange={set('tipo')}>{Object.entries(TIPOS).map(([k, v]: any) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Tema"><input className="inp" list="temas" value={f.tema} onChange={set('tema')} /><datalist id="temas">{temas.map((t: any) => <option key={t} value={t} />)}</datalist></Field>
          <Field label="Pontos"><input className="inp" type="number" step="0.5" min="0" value={f.pontos} onChange={set('pontos')} /></Field>
        </div>
        <Field label="Tópico detalhado (opcional)"><input className="inp" value={f.topico} onChange={set('topico')} /></Field>
        <Field label="Enunciado"><textarea className="inp min-h-24" required value={f.enunciado} onChange={set('enunciado')} /></Field>
        {f.tipo === 'multipla' && <Field label="Alternativas (uma por linha — A, B, C…)"><textarea className="inp min-h-28" value={f.opcoes} onChange={set('opcoes')} /></Field>}
        {f.tipo === 'multipla' && <Field label="Gabarito"><select className="inp" value={f.gabarito} onChange={set('gabarito')}><option value="">Escolha…</option>{opts.map((_: any, i: number) => <option key={i} value={letter(i)}>{letter(i)}</option>)}</select></Field>}
        {f.tipo === 'vf' && <Field label="Gabarito"><select className="inp" value={f.gabarito} onChange={set('gabarito')}><option value="">Escolha…</option><option value="V">Verdadeiro</option><option value="F">Falso</option></select></Field>}
        {f.tipo === 'aberta' && <>
          <Field label="Resposta de referência (benchmark)"><textarea className="inp min-h-28" value={f.gabarito} onChange={set('gabarito')} /></Field>
          <Field label="Elementos-chave esperados (um por linha)"><textarea className="inp" value={f.elementos} onChange={set('elementos')} /></Field>
          <label className="lbl">Critérios por nota</label>
          <div className="grid sm:grid-cols-2 gap-2">{[0, 1, 2, 3].map((n) => <textarea key={n} className="inp" placeholder={`Nota ${n}`} value={f['c' + n]} onChange={set('c' + n)} />)}</div>
          <Field label="Orientação geral de correção"><textarea className="inp" value={f.rubrica} onChange={set('rubrica')} /></Field>
        </>}
        <Field label="Explicação (mostrada após o encerramento)"><textarea className="inp" value={f.explicacao} onChange={set('explicacao')} /></Field>
        <Field label="Aviso de falha crítica (opcional)"><input className="inp" value={f.aviso_critico} onChange={set('aviso_critico')} /></Field>
        <div className="flex flex-wrap gap-5 mt-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-red-700" checked={f.critica} onChange={set('critica')} />Questão crítica (falha exige correção + simulação)</label>
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-amber-700" checked={f.ativa} onChange={set('ativa')} />Ativa</label>
        </div>
        <div className="flex gap-2 mt-5"><button className="btn-pri">Salvar</button><button type="button" className="btn" onClick={onClose}>Cancelar</button></div>
      </form>
    </Modal>
  );
}
