export const fmt = (d?: any) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
export const fmtDay = (d?: any) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');
export const pct = (a: any, b: any) => (Number(b) > 0 ? Math.round((Number(a) / Number(b)) * 1000) / 10 : 0);
export const pctInt = (a: any, b: any) => Math.round(pct(a, b));
export const num = (n: any) => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
export const letter = (i: number) => String.fromCharCode(65 + i);
export const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7); };
export const toLocalInput = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
export const slug = (s: string) => (s || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();

export type Faixa = { key: 'aprovado' | 'reforco' | 'retreinamento'; label: string; cls: string; texto: string };
/** Critérios do Documento Executivo: ≥85 aprovado; 70–84,9 reforço + nova avaliação; <70 retreinamento. */
export function faixa(p: number, aprov = 85, ref = 70): Faixa {
  if (p >= aprov) return { key: 'aprovado', label: 'Aprovada', cls: 'emerald', texto: 'Excelente! Você demonstra domínio do Jeito Gaya.' };
  if (p >= ref) return { key: 'reforco', label: 'Reforço direcionado', cls: 'amber', texto: 'Bom caminho. Vamos reforçar alguns temas e fazer uma nova avaliação.' };
  return { key: 'retreinamento', label: 'Retreinamento', cls: 'red', texto: 'Vamos retreinar os conceitos com a coordenação antes de uma nova tentativa.' };
}
export const faixaCls = (c: string) => ({
  emerald: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  amber: 'bg-amber-50 border-amber-200 text-amber-900',
  red: 'bg-red-50 border-red-200 text-red-900',
} as any)[c];

export function download(name: string, content: string | Blob, type = 'text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function csv(name: string, rows: any[][]) {
  const body = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\r\n');
  download(name, '﻿' + body, 'text/csv;charset=utf-8');
}
export async function pdf(title: string, subtitle: string, head: string[], rows: any[][], filename: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: head.length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(16); doc.text(title, 14, 16);
  doc.setFontSize(9); doc.setTextColor(110); doc.text(subtitle, 14, 22);
  autoTable(doc, { head: [head], body: rows.map((r) => r.map((c) => String(c ?? ''))), startY: 27, styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [28, 25, 23] } });
  doc.save(filename);
}

export const TEMA_ETAPAS = ['Acolhimento e contextualização', 'Qualificação consultiva adaptativa', 'Recomendação personalizada', 'Conversão e agendamento', 'Confirmação e preparação da experiência', 'Recuperação de oportunidades e relacionamento'];
export const STATUS_KZ: Record<string, string> = { perda_confirmada: 'Perda confirmada', parada: 'Oportunidade parada', recuperavel: 'Oportunidade recuperável' };
export const MOTIVOS: Record<string, string> = { preco: 'Preço', timing: 'Timing / momento', disponibilidade: 'Disponibilidade', oferta: 'Oferta / serviço', conducao: 'Condução do atendimento', concorrencia: 'Concorrência', sem_resposta: 'Sem resposta', outro: 'Outro' };
export const CATEGORIAS = ['SPA', 'Yoga', 'Gift Card', 'Outro'];
