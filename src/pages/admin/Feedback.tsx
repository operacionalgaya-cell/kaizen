import React, { useEffect, useState } from 'react';
import { sb } from '../../lib/supabase';
import { useApp, run } from '../../lib/app';
import { Modal, Loading } from '../../lib/ui';
import { num, pct, faixa } from '../../lib/util';

/** Feedback contínuo ligado a uma prova corrigida (rascunho gerado a partir do desempenho). */
export function FeedbackModal({ tid, onClose }: { tid: string; onClose: () => void }) {
  const { me, cfg, toast } = useApp();
  const [st, setSt] = useState<any>(null);
  const [texto, setTexto] = useState('');
  const [temasSel, setTemasSel] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const r = await run(sb.rpc('resultado_tentativa', { p_tentativa: tid }));
      const t = r.tentativa;
      const { data: prof } = await sb.from('profiles').select('nome').eq('id', t.user_id).single();
      const byT: Record<string, { p: number; m: number }> = {};
      r.itens.forEach((q: any) => { if (q.pontos != null) { const o = (byT[q.tema] ||= { p: 0, m: 0 }); o.p += Number(q.pontos); o.m += Number(q.pontos_max); } });
      const arr = Object.entries(byT).map(([tema, o]) => ({ tema, p: Math.round(pct(o.p, o.m)) }));
      const fortes = arr.filter((x) => x.p >= cfg.nota_aprovacao);
      const fracos = arr.filter((x) => x.p < cfg.nota_reforco + 10).sort((a, b) => a.p - b.p);
      const nota = pct(t.nota_total, t.nota_max); const fx = faixa(nota, cfg.nota_aprovacao, cfg.nota_reforco);
      let tx = `Olá, ${(prof?.nome || '').split(' ')[0]}! Seu resultado em "${r.avaliacao.titulo}": ${num(t.nota_total)}/${num(t.nota_max)} (${nota.toFixed(1).replace('.', ',')}/100) — ${fx.label.toLowerCase()}.\n\n`;
      if (fortes.length) tx += `O que está forte: ${fortes.map((x) => `${x.tema} (${x.p}%)`).join(', ')}.\n\n`;
      if (fracos.length) tx += `Para reforçar: ${fracos.map((x) => `${x.tema} (${x.p}%)`).join(', ')}.\n\n`;
      if (t.falha_critica) tx += 'Houve falha crítica: vamos corrigir o ponto e fazer uma simulação prática juntas.\n\n';
      tx += 'Como a conversa poderia ser conduzida de outra forma / exemplo alternativo: \n\nAprendizado prático para o próximo atendimento: ';
      setSt({ t, prof, fracos }); setTexto(tx); setTemasSel(fracos.map((x) => x.tema));
    })().catch((e) => { toast(e.message, true); onClose(); });
  }, []);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await run(sb.from('feedbacks').insert({ tentativa_id: tid, user_id: st.t.user_id, texto: texto.trim(), temas_reforco: temasSel, created_by: me!.id })); toast('Feedback enviado'); onClose(); }
    catch (er: any) { toast(er.message, true); }
  };
  return (
    <Modal title={`Feedback${st ? ' para ' + (st.prof?.nome || '') : ''}`} onClose={onClose} wide>
      {!st ? <Loading /> : (
        <form onSubmit={enviar}>
          <p className="text-xs text-stone-500">Rascunho gerado a partir do desempenho. Ajuste, inclua evidência e uma alternativa concreta, e envie. Feedback educativo, sem punição automática.</p>
          <label className="lbl">Texto</label><textarea className="inp min-h-64" required value={texto} onChange={(e) => setTexto(e.target.value)} />
          <label className="lbl">Temas de reforço</label>
          <div className="flex flex-wrap gap-2">{st.fracos.length ? st.fracos.map((x: any) => (
            <label key={x.tema} className="flex items-center gap-1.5 text-xs"><input type="checkbox" className="accent-amber-700" checked={temasSel.includes(x.tema)} onChange={() => setTemasSel((s) => s.includes(x.tema) ? s.filter((y) => y !== x.tema) : [...s, x.tema])} />{x.tema} ({x.p}%)</label>)) : <span className="text-xs text-stone-400">Nenhum</span>}</div>
          <div className="flex gap-2 mt-5"><button className="btn-pri">Enviar feedback</button><button type="button" className="btn" onClick={onClose}>Agora não</button></div>
        </form>)}
    </Modal>
  );
}
