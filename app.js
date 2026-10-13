import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY } from './config.js';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const app = document.getElementById('app');

/* ============================ helpers ============================ */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (d) => (d ? new Date(d).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const pct = (a, b) => (Number(b) > 0 ? Math.round((Number(a) / Number(b)) * 100) : 0);
const num = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
const letter = (i) => String.fromCharCode(65 + i);
const barCls = (p) => (p < 60 ? 'low' : p < 80 ? 'mid' : '');
const bar = (p) => `<div class="bar ${barCls(p)}"><i style="width:${Math.min(100, p)}%"></i></div>`;
const statusPill = (s) => ({ em_andamento: '<span class="pill warn">em andamento</span>', enviada: '<span class="pill warn">aguardando correção</span>', corrigida: '<span class="pill ok">corrigida</span>', rascunho: '<span class="pill">rascunho</span>', publicada: '<span class="pill ok">publicada</span>', encerrada: '<span class="pill">encerrada</span>' }[s] || esc(s));
const nextMonth = () => { const d = new Date(); d.setMonth(d.getMonth() + 1); return d.toISOString().slice(0, 7); };
const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

function toast(msg, err) {
  const t = document.createElement('div');
  t.className = 'toast' + (err ? ' err' : '');
  t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 4500);
}
async function run(p) {
  const r = await p;
  if (r.error) { toast(r.error.message, true); throw r.error; }
  return r.data;
}
function download(name, content, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([content], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function csv(name, rows) {
  const body = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
  download(name, '﻿' + body, 'text/csv;charset=utf-8');
}
function pdf(title, subtitle, head, rows, filename) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16); doc.text(title, 14, 18);
  doc.setFontSize(10); doc.text(subtitle, 14, 25);
  doc.autoTable({ startY: 30, head: [head], body: rows, styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [31, 61, 54] } });
  doc.save(filename);
}
function openDialog(html, onMount) {
  const d = document.createElement('dialog');
  d.innerHTML = html;
  document.body.append(d);
  d.addEventListener('close', () => d.remove());
  d.showModal();
  d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => d.close()));
  onMount?.(d);
  return d;
}

let me = null;
let unread = 0;
let timerId = null;

/* ============================ auth ============================ */
function authView(mode = 'login') {
  const reg = mode === 'cadastro';
  app.innerHTML = `<main><form class="card auth" id="af">
    <h1>Kaizen</h1><p class="muted">${reg ? 'Crie sua conta. Um administrador precisa aprovar seu acesso.' : 'Entre para ver suas avaliações.'}</p>
    ${reg ? '<label>Nome completo</label><input name="nome" required autocomplete="name">' : ''}
    <label>E-mail</label><input name="email" type="email" required autocomplete="email">
    <label>Senha</label><input name="senha" type="password" required minlength="8" autocomplete="${reg ? 'new-password' : 'current-password'}">
    <div class="row" style="margin-top:1rem"><button class="pri" type="submit">${reg ? 'Criar conta' : 'Entrar'}</button>
    <button type="button" id="alt">${reg ? 'Já tenho conta' : 'Criar conta'}</button></div>
    ${reg ? '' : '<p class="small"><a href="#" id="forgot">Esqueci minha senha</a></p>'}</form></main>`;
  document.getElementById('alt').onclick = () => authView(reg ? 'login' : 'cadastro');
  const f = document.getElementById('forgot');
  if (f) f.onclick = async (e) => {
    e.preventDefault();
    const email = document.querySelector('[name=email]').value;
    if (!email) return toast('Digite seu e-mail primeiro', true);
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    toast(error ? error.message : 'Enviamos um link para redefinir a senha', !!error);
  };
  document.getElementById('af').onsubmit = async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    if (reg) {
      const { data, error } = await sb.auth.signUp({ email: v.email, password: v.senha, options: { data: { nome: v.nome } } });
      if (error) return toast(error.message, true);
      if (!data.session) { toast('Conta criada! Confirme seu e-mail e depois entre.'); return authView('login'); }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: v.email, password: v.senha });
      if (error) return toast('E-mail ou senha incorretos', true);
    }
    boot();
  };
}

async function logout() { await sb.auth.signOut(); me = null; authView(); }

/* ============================ shell ============================ */
async function refreshUnread() {
  const { count } = await sb.from('notificacoes').select('id', { count: 'exact', head: true }).eq('user_id', me.id).eq('lida', false);
  unread = count || 0;
}

function shell(content) {
  const admin = me.role === 'admin';
  const links = admin
    ? [['#/admin', 'Painel'], ['#/admin/questoes', 'Questões'], ['#/admin/turmas', 'Turmas'], ['#/admin/avaliacoes', 'Avaliações'], ['#/admin/correcoes', 'Correções'], ['#/admin/equipe', 'Equipe'], ['#/notificacoes', 'Avisos']]
    : [['#/', 'Início'], ['#/notificacoes', 'Avisos']];
  const cur = location.hash || '#/';
  app.innerHTML = `<header class="top"><span class="brand">Kaizen</span><span class="sp"></span><span class="small">${esc(me.nome || me.email)}</span><button data-act="logout">Sair</button></header>
  <nav class="nav">${links.map(([h, l]) => `<a href="${h}" class="${cur === h ? 'on' : ''}">${l}${h === '#/notificacoes' && unread ? `<span class="badge">${unread}</span>` : ''}</a>`).join('')}</nav>
  <main>${content}</main>`;
}

/* ============================ router ============================ */
async function route() {
  if (!me) return;
  clearInterval(timerId);
  const p = (location.hash || '#/').replace(/^#\/?/, '').split('/');
  try {
    await refreshUnread();
    if (p[0] === 'admin' && me.role !== 'admin') { location.hash = '#/'; return; }
    if (p[0] === '' && me.role === 'admin') { location.hash = '#/admin'; return; }
    if (p[0] === '') return await homeView();
    if (p[0] === 'prova') return await provaView(p[1]);
    if (p[0] === 'resultado') return await resultadoView(p[1]);
    if (p[0] === 'notificacoes') return await notifView();
    if (p[0] === 'admin') {
      if (!p[1]) return await painelView();
      if (p[1] === 'questoes') return await questoesView();
      if (p[1] === 'turmas') return await turmasView();
      if (p[1] === 'avaliacoes') return await avaliacoesView();
      if (p[1] === 'correcoes') return await correcoesView();
      if (p[1] === 'corrigir') return await corrigirView(p[2]);
      if (p[1] === 'equipe') return await equipeView();
      if (p[1] === 'colab') return await colabView(p[2]);
    }
    shell('<div class="card">Página não encontrada.</div>');
  } catch (e) {
    console.error(e);
    shell(`<div class="card"><h2>Algo deu errado</h2><p class="muted">${esc(e.message || e)}</p></div>`);
  }
}

/* ============================ colaborador ============================ */
async function homeView() {
  const [avs, tents, fbs] = await Promise.all([
    run(sb.from('avaliacoes').select('*').neq('status', 'rascunho').order('created_at', { ascending: false })),
    run(sb.from('tentativas').select('*').eq('user_id', me.id)),
    run(sb.from('feedbacks').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(10)),
  ]);
  const tmap = Object.fromEntries(tents.map((t) => [t.avaliacao_id, t]));
  const amap = Object.fromEntries(avs.map((a) => [a.id, a]));
  const now = Date.now();
  const pend = avs.filter((a) => a.status === 'publicada' && (!tmap[a.id] || tmap[a.id].status === 'em_andamento'));
  const done = tents.filter((t) => t.status !== 'em_andamento').sort((a, b) => new Date(b.enviada_em) - new Date(a.enviada_em));
  shell(`
    <h1>Olá, ${esc((me.nome || '').split(' ')[0] || 'tudo bem')}!</h1>
    <h2>Pendentes</h2>
    ${pend.length ? pend.map((a) => {
      const late = a.prazo && new Date(a.prazo) < now;
      const t = tmap[a.id];
      return `<div class="card"><div class="row between"><div><h3>${esc(a.titulo)}</h3>
        <div class="muted small">${a.mes ? esc(a.mes) + ' · ' : ''}prazo: ${fmt(a.prazo)}${a.tempo_limite_min ? ` · ${a.tempo_limite_min} min` : ''}</div></div>
        ${late ? '<span class="pill bad">prazo encerrado</span>' : `<button class="pri" data-act="iniciar" data-id="${a.id}">${t ? 'Continuar' : 'Iniciar'}</button>`}</div>
        ${a.descricao ? `<p class="small">${esc(a.descricao)}</p>` : ''}</div>`;
    }).join('') : '<div class="card muted">Nenhuma avaliação pendente. 🎉</div>'}
    <h2>Meu histórico</h2>
    ${done.length ? `<div class="card tbl"><table><thead><tr><th>Avaliação</th><th>Enviada</th><th>Nota</th><th></th></tr></thead><tbody>
      ${done.map((t) => `<tr><td>${esc(amap[t.avaliacao_id]?.titulo || '—')}</td><td>${fmt(t.enviada_em)}</td>
      <td>${t.status === 'corrigida' ? `${num(t.nota_total)}/${num(t.nota_max)} (${pct(t.nota_total, t.nota_max)}%)` : statusPill(t.status)}</td>
      <td><a class="btn sm" href="#/resultado/${t.id}">Ver</a></td></tr>`).join('')}</tbody></table></div>` : '<div class="card muted">Você ainda não concluiu nenhuma avaliação.</div>'}
    <h2>Feedbacks recebidos</h2>
    ${fbs.length ? fbs.map((f) => `<div class="card ${f.lido ? '' : 'unread'}"><div class="muted small">${fmt(f.created_at)}</div><p style="white-space:pre-wrap">${esc(f.texto)}</p>
      ${(f.temas_reforco || []).map((t) => `<span class="chip">${esc(t)}</span>`).join('')}
      ${f.tentativa_id ? `<div><a href="#/resultado/${f.tentativa_id}" class="small">Ver avaliação</a></div>` : ''}</div>`).join('') : '<div class="card muted">Sem feedbacks por enquanto.</div>'}`);
}

async function provaView(tid) {
  const { data: prova, error } = await sb.rpc('obter_prova', { p_tentativa: tid });
  if (error) { location.hash = '#/resultado/' + tid; return; }
  const key = 'kaizen_rasc_' + tid;
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch { /* ignore */ }
  const total = prova.itens.reduce((s, q) => s + Number(q.pontos), 0);
  shell(`<div class="row between"><h1>${esc(prova.titulo)}</h1>${prova.tempo_limite_min ? '<span class="timer" id="tm">—</span>' : ''}</div>
    <p class="muted small">${prova.itens.length} questões · ${num(total)} pontos${prova.descricao ? ' · ' + esc(prova.descricao) : ''}</p>
    <form id="pf">${prova.itens.map((q, i) => `<div class="card q"><div class="small muted">${i + 1}. ${esc(q.tema)} · ${num(q.pontos)} pt</div>
      <p><strong>${esc(q.enunciado)}</strong></p>${renderInput(q, saved[q.id])}</div>`).join('')}
      <div class="row"><button class="pri" type="submit">Enviar avaliação</button><span class="muted small">Seu progresso é salvo neste aparelho.</span></div></form>`);
  const form = document.getElementById('pf');
  const collect = () => {
    const out = {};
    for (const q of prova.itens) {
      if (q.tipo === 'aberta') out[q.id] = form.elements['q_' + q.id].value;
      else { const c = form.querySelector(`input[name="q_${q.id}"]:checked`); out[q.id] = c ? c.value : ''; }
    }
    return out;
  };
  form.addEventListener('input', () => { try { localStorage.setItem(key, JSON.stringify(collect())); } catch { /* ignore */ } });
  const submit = async () => {
    const { error: e2 } = await sb.rpc('enviar_tentativa', { p_tentativa: tid, p_respostas: collect() });
    if (e2) return toast(e2.message, true);
    localStorage.removeItem(key);
    toast('Avaliação enviada!');
    location.hash = '#/resultado/' + tid;
  };
  form.onsubmit = async (e) => {
    e.preventDefault();
    const vals = Object.values(collect());
    const vazias = vals.filter((v) => !String(v).trim()).length;
    if (vazias && !confirm(`Você deixou ${vazias} questão(ões) em branco. Enviar mesmo assim?`)) return;
    if (!vazias && !confirm('Enviar a avaliação? Não será possível alterar depois.')) return;
    await submit();
  };
  if (prova.tempo_limite_min) {
    const end = new Date(prova.iniciada_em).getTime() + prova.tempo_limite_min * 60000;
    const tick = () => {
      const left = end - Date.now();
      const el = document.getElementById('tm');
      if (!el) return clearInterval(timerId);
      if (left <= 0) { clearInterval(timerId); el.textContent = 'Tempo esgotado'; toast('Tempo esgotado — enviando'); submit(); return; }
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      el.textContent = `⏱ ${m}:${String(s).padStart(2, '0')}`;
    };
    tick(); timerId = setInterval(tick, 1000);
  }
}

function renderInput(q, val) {
  if (q.tipo === 'aberta') return `<textarea name="q_${q.id}" placeholder="Escreva sua resposta…">${esc(val || '')}</textarea>`;
  const opts = q.tipo === 'vf' ? [['V', 'Verdadeiro'], ['F', 'Falso']] : (q.opcoes || []).map((t, i) => [letter(i), t]);
  return opts.map(([v, t]) => `<label class="opt"><input type="radio" name="q_${q.id}" value="${v}" ${val === v ? 'checked' : ''}><span>${q.tipo === 'vf' ? '' : `<b>${v}.</b> `}${esc(t)}</span></label>`).join('');
}

function answerText(q, v) {
  if (v == null || v === '') return '<em class="muted">(em branco)</em>';
  if (q.tipo === 'vf') return v === 'V' ? 'Verdadeiro' : 'Falso';
  if (q.tipo === 'multipla') { const i = v.toUpperCase().charCodeAt(0) - 65; return `${esc(v)}. ${esc(q.opcoes?.[i] ?? '')}`; }
  return esc(v);
}

async function resultadoView(tid) {
  const r = await run(sb.rpc('resultado_tentativa', { p_tentativa: tid }));
  const t = r.tentativa;
  const own = t.user_id === me.id;
  const fbs = await run(sb.from('feedbacks').select('*').eq('tentativa_id', tid).order('created_at', { ascending: false }));
  if (own) { await sb.from('feedbacks').update({ lido: true }).eq('tentativa_id', tid).eq('user_id', me.id); }
  const crit = r.itens.filter((q) => q.critica && q.correta === false);
  shell(`<a href="${own ? '#/' : '#/admin/equipe'}" class="small">← Voltar</a>
    <h1>${esc(r.avaliacao.titulo)}</h1>
    <div class="card"><div class="row between"><div>${t.status === 'corrigida'
      ? `<div class="kpi"><div class="v">${num(t.nota_total)} / ${num(t.nota_max)}</div><div class="l">${pct(t.nota_total, t.nota_max)}% de aproveitamento</div></div>`
      : `<strong>Aguardando correção das questões abertas</strong><div class="muted small">Parcial nas objetivas: ${num(t.nota_auto)} pontos</div>`}</div>
      <div>${statusPill(t.status)}${t.fora_do_tempo ? ' <span class="pill bad">fora do tempo</span>' : ''}</div></div>
      ${crit.length ? '<p><span class="pill crit">Falha crítica</span> Há questão crítica errada — conversar com a coordenação e refazer a simulação prática.</p>' : ''}
      ${r.avaliacao.status !== 'encerrada' && own ? '<p class="small muted">O gabarito das objetivas será liberado quando a avaliação for encerrada.</p>' : ''}</div>
    ${fbs.map((f) => `<div class="card unread"><strong>Feedback</strong><div class="muted small">${fmt(f.created_at)}</div><p style="white-space:pre-wrap">${esc(f.texto)}</p>${(f.temas_reforco || []).map((x) => `<span class="chip">${esc(x)}</span>`).join('')}</div>`).join('')}
    ${r.itens.map((q, i) => {
      const cls = q.correta === true ? 'ok' : q.correta === false ? 'bad' : (q.pontos == null ? 'pend' : 'ok');
      return `<div class="card q ${cls}"><div class="small muted">${i + 1}. ${esc(q.tema)} · ${q.pontos == null ? '—' : num(q.pontos)}/${num(q.pontos_max)} pt ${q.critica ? '<span class="pill crit">crítica</span>' : ''}</div>
        <p><strong>${esc(q.enunciado)}</strong></p>
        <div class="small"><b>Sua resposta:</b> <span style="white-space:pre-wrap">${answerText(q, q.resposta)}</span></div>
        ${q.gabarito != null ? `<div class="small"><b>${q.tipo === 'aberta' ? 'Referência' : 'Gabarito'}:</b> ${q.tipo === 'aberta' ? esc(q.gabarito) : answerText(q, q.gabarito)}</div>` : ''}
        ${q.comentario ? `<div class="small"><b>Comentário do avaliador:</b> ${esc(q.comentario)}</div>` : ''}</div>`;
    }).join('')}
    <div class="row"><button data-act="pdf-tentativa" data-id="${tid}">Baixar PDF</button></div>`);
}

async function notifView() {
  const list = await run(sb.from('notificacoes').select('*').eq('user_id', me.id).order('created_at', { ascending: false }).limit(60));
  const subOk = 'serviceWorker' in navigator && 'PushManager' in window;
  shell(`<div class="row between"><h1>Avisos</h1><div class="row"><button data-act="push">Ativar notificações push</button><button data-act="lerTodas">Marcar todas como lidas</button></div></div>
    ${subOk ? '' : '<p class="small muted">Push indisponível neste navegador. No iPhone, adicione o Kaizen à Tela de Início (Compartilhar → Adicionar à Tela de Início) e abra por lá.</p>'}
    ${list.length ? list.map((n) => `<a class="card ${n.lida ? '' : 'unread'}" style="display:block;text-decoration:none;color:inherit" href="${esc(n.url || '#/')}" data-act="lida" data-id="${n.id}">
      <strong>${esc(n.titulo)}</strong><div class="small">${esc(n.corpo)}</div><div class="muted small">${fmt(n.created_at)}</div></a>`).join('') : '<div class="card muted">Nenhum aviso.</div>'}`);
}

/* ============================ admin: painel ============================ */
async function painelView() {
  const [profs, tents, avs, membros, temas, qstats] = await Promise.all([
    run(sb.from('profiles').select('id,nome,ativo,role')),
    run(sb.from('tentativas').select('id,user_id,avaliacao_id,status,nota_total,nota_max,enviada_em,profiles(nome),avaliacoes(titulo,mes)').range(0, 4999)),
    run(sb.from('avaliacoes').select('id,titulo,mes,status,prazo')),
    run(sb.from('turma_membros').select('user_id,turmas(nome)')),
    run(sb.from('v_desempenho_user_tema').select('*')),
    run(sb.from('v_questao_stats').select('*').order('pct_acerto', { ascending: true }).limit(5)),
  ]);
  const colabs = profs.filter((p) => p.role === 'colaborador' && p.ativo);
  const pendAprov = profs.filter((p) => !p.ativo).length;
  const corr = tents.filter((t) => t.status === 'corrigida');
  const aguard = tents.filter((t) => t.status === 'enviada').length;
  const media = corr.length ? Math.round(corr.reduce((s, t) => s + pct(t.nota_total, t.nota_max), 0) / corr.length) : 0;
  const abertas = avs.filter((a) => a.status === 'publicada').length;

  const byMes = {};
  corr.forEach((t) => { const m = t.avaliacoes?.mes || '—'; (byMes[m] ||= []).push(pct(t.nota_total, t.nota_max)); });
  const mesRows = Object.entries(byMes).sort().map(([m, v]) => [m, v.length, Math.round(v.reduce((a, b) => a + b, 0) / v.length)]);

  const turmaOf = {};
  membros.forEach((m) => { (turmaOf[m.turmas?.nome || '—'] ||= []).push(m.user_id); });
  const turmaRows = Object.entries(turmaOf).map(([n, ids]) => {
    const ts = corr.filter((t) => ids.includes(t.user_id));
    return [n, ids.length, ts.length ? Math.round(ts.reduce((s, t) => s + pct(t.nota_total, t.nota_max), 0) / ts.length) : null];
  });

  const byTema = {};
  temas.forEach((r) => { const o = (byTema[r.tema] ||= { p: 0, m: 0 }); o.p += Number(r.pontos); o.m += Number(r.pontos_max); });
  const temaRows = Object.entries(byTema).map(([t, o]) => [t, pct(o.p, o.m)]).sort((a, b) => a[1] - b[1]);

  shell(`<div class="row between"><h1>Painel</h1><div class="row"><button data-act="export-equipe-pdf">PDF da equipe</button><button data-act="export-equipe-csv">CSV</button></div></div>
    <div class="grid g4">
      <div class="card kpi"><div class="v">${colabs.length}</div><div class="l">colaboradores ativos</div></div>
      <div class="card kpi"><div class="v">${media}%</div><div class="l">média geral</div></div>
      <div class="card kpi"><div class="v">${abertas}</div><div class="l">avaliações abertas</div></div>
      <div class="card kpi"><div class="v">${aguard}</div><div class="l">${aguard === 1 ? 'correção pendente' : 'correções pendentes'}</div></div>
    </div>
    ${pendAprov ? `<div class="card unread">${pendAprov} cadastro(s) aguardando aprovação. <a href="#/admin/equipe">Revisar</a></div>` : ''}
    ${aguard ? `<div class="card unread">Há provas aguardando correção. <a href="#/admin/correcoes">Corrigir agora</a></div>` : ''}
    <div class="grid g2">
      <div class="card"><h3>Evolução mês a mês</h3>${mesRows.length ? `<table><thead><tr><th>Mês</th><th>Provas</th><th>Média</th></tr></thead><tbody>${mesRows.map(([m, n, p]) => `<tr><td>${esc(m)}</td><td>${n}</td><td>${bar(p)}<span class="small">${p}%</span></td></tr>`).join('')}</tbody></table>` : '<p class="muted">Sem dados ainda.</p>'}</div>
      <div class="card"><h3>Desempenho por turma</h3>${turmaRows.length ? `<table><thead><tr><th>Turma</th><th>Pessoas</th><th>Média</th></tr></thead><tbody>${turmaRows.map(([n, c, p]) => `<tr><td>${esc(n)}</td><td>${c}</td><td>${p == null ? '—' : bar(p) + `<span class="small">${p}%</span>`}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Crie turmas para comparar.</p>'}</div>
      <div class="card"><h3>Temas que mais precisam de reforço</h3>${temaRows.length ? temaRows.map(([t, p]) => `<div class="row between small"><span>${esc(t)}</span><span>${p}%</span></div>${bar(p)}`).join('') : '<p class="muted">Sem dados ainda.</p>'}</div>
      <div class="card"><h3>Questões mais erradas</h3>${qstats.length ? qstats.map((q) => `<div class="small" style="margin-bottom:.5rem"><span class="pill">${esc(q.tema)}</span> ${esc(q.enunciado.slice(0, 90))}${q.enunciado.length > 90 ? '…' : ''} <b>${q.pct_acerto}% acerto</b> (${q.total})</div>`).join('') : '<p class="muted">Sem dados ainda.</p>'}</div>
    </div>`);
  window.__teamData = { colabs, corr };
}

/* ============================ admin: questões ============================ */
let QCACHE = [];
async function questoesView() {
  QCACHE = await run(sb.from('questoes').select('*').order('created_at', { ascending: false }).range(0, 4999));
  const temas = [...new Set(QCACHE.map((q) => q.tema))].sort();
  shell(`<div class="row between"><h1>Banco de questões <span class="muted small">(${QCACHE.length})</span></h1>
    <div class="row"><button class="pri" data-act="q-new">Nova questão</button><button data-act="q-import">Importar JSON</button><button data-act="q-export">Exportar JSON</button></div></div>
    <input type="file" id="qfile" accept=".json,application/json" hidden>
    <div class="card row"><input id="qs" placeholder="Buscar no enunciado…" style="flex:2;min-width:180px"><select id="qt" style="flex:1;min-width:120px"><option value="">Todos os tipos</option><option value="multipla">Múltipla escolha</option><option value="vf">Verdadeiro/Falso</option><option value="aberta">Aberta</option></select>
    <select id="qm" style="flex:1;min-width:120px"><option value="">Todos os temas</option>${temas.map((t) => `<option>${esc(t)}</option>`).join('')}</select></div>
    <div id="ql"></div>`);
  const draw = () => {
    const s = document.getElementById('qs').value.toLowerCase(), t = document.getElementById('qt').value, m = document.getElementById('qm').value;
    const list = QCACHE.filter((q) => (!s || q.enunciado.toLowerCase().includes(s)) && (!t || q.tipo === t) && (!m || q.tema === m));
    document.getElementById('ql').innerHTML = list.length ? list.map((q) => `<div class="card"><div class="row between"><div><span class="pill">${{ multipla: 'múltipla', vf: 'V/F', aberta: 'aberta' }[q.tipo]}</span> <span class="pill">${esc(q.tema)}</span> ${q.critica ? '<span class="pill crit">crítica</span>' : ''} ${q.ativa ? '' : '<span class="pill warn">inativa</span>'}</div>
      <div class="row"><button class="sm" data-act="q-edit" data-id="${q.id}">Editar</button><button class="sm dan" data-act="q-del" data-id="${q.id}">Excluir</button></div></div>
      <p style="margin:.5rem 0 0">${esc(q.enunciado)}</p><div class="small muted">${num(q.pontos)} pt · gabarito: ${q.tipo === 'aberta' ? '(referência)' : esc(q.gabarito)}</div></div>`).join('') : '<div class="card muted">Nenhuma questão encontrada.</div>';
  };
  ['qs', 'qt', 'qm'].forEach((id) => document.getElementById(id).addEventListener('input', draw));
  draw();
  document.getElementById('qfile').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text());
      const arr = Array.isArray(j) ? j : j.questoes;
      const rows = arr.map((q) => ({ tipo: q.tipo, tema: q.tema || 'Geral', enunciado: q.enunciado, opcoes: q.opcoes || null, gabarito: q.gabarito ?? null, rubrica: q.rubrica ?? null, pontos: q.pontos ?? 1, critica: !!q.critica, ativa: q.ativa !== false }));
      if (!rows.length || rows.some((r) => !['multipla', 'vf', 'aberta'].includes(r.tipo) || !r.enunciado)) throw new Error('Formato inválido');
      await run(sb.from('questoes').insert(rows));
      toast(`${rows.length} questões importadas`); route();
    } catch (err) { toast('Falha ao importar: ' + err.message, true); }
  };
}

function questaoDialog(q = {}) {
  const d = openDialog(`<form id="qf"><h2>${q.id ? 'Editar' : 'Nova'} questão</h2>
    <div class="row"><div style="flex:1"><label>Tipo</label><select name="tipo"><option value="multipla">Múltipla escolha</option><option value="vf">Verdadeiro/Falso</option><option value="aberta">Aberta</option></select></div>
    <div style="flex:1"><label>Tema</label><input name="tema" required value="${esc(q.tema || '')}" placeholder="Ex.: Qualificação"></div>
    <div style="width:90px"><label>Pontos</label><input name="pontos" type="number" step="0.5" min="0" value="${q.pontos ?? 1}"></div></div>
    <label>Enunciado</label><textarea name="enunciado" required>${esc(q.enunciado || '')}</textarea>
    <div id="f-mc"><label>Alternativas (uma por linha, na ordem A, B, C…)</label><textarea name="opcoes">${esc((q.opcoes || []).join('\n'))}</textarea>
      <label>Alternativa correta</label><select name="g_mc">${['A', 'B', 'C', 'D', 'E'].map((l) => `<option ${q.gabarito === l ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div id="f-vf"><label>Resposta correta</label><select name="g_vf"><option value="V" ${q.gabarito === 'V' ? 'selected' : ''}>Verdadeiro</option><option value="F" ${q.gabarito === 'F' ? 'selected' : ''}>Falso</option></select></div>
    <div id="f-ab"><label>Resposta-referência</label><textarea name="g_ab">${esc(q.tipo === 'aberta' ? q.gabarito || '' : '')}</textarea><label>Rubrica / critério de correção</label><textarea name="rubrica">${esc(q.rubrica || '')}</textarea></div>
    <label class="chk"><input type="checkbox" name="critica" ${q.critica ? 'checked' : ''}> Falha crítica (erro exige correção e nova simulação)</label>
    <label class="chk"><input type="checkbox" name="ativa" ${q.ativa === false ? '' : 'checked'}> Ativa</label>
    <div class="row" style="margin-top:1rem"><button class="pri" type="submit">Salvar</button><button type="button" data-close>Cancelar</button></div></form>`, (dlg) => {
    const f = dlg.querySelector('#qf');
    f.tipo.value = q.tipo || 'multipla';
    const sync = () => { dlg.querySelector('#f-mc').hidden = f.tipo.value !== 'multipla'; dlg.querySelector('#f-vf').hidden = f.tipo.value !== 'vf'; dlg.querySelector('#f-ab').hidden = f.tipo.value !== 'aberta'; };
    f.tipo.onchange = sync; sync();
    f.onsubmit = async (e) => {
      e.preventDefault();
      const tipo = f.tipo.value;
      const opcoes = tipo === 'multipla' ? f.opcoes.value.split('\n').map((s) => s.trim()).filter(Boolean) : null;
      if (tipo === 'multipla' && (opcoes.length < 2 || f.g_mc.value.charCodeAt(0) - 65 >= opcoes.length)) return toast('Informe as alternativas e uma letra de gabarito válida', true);
      const row = { tipo, tema: f.tema.value.trim(), enunciado: f.enunciado.value.trim(), opcoes, pontos: Number(f.pontos.value) || 1,
        gabarito: tipo === 'multipla' ? f.g_mc.value : tipo === 'vf' ? f.g_vf.value : f.g_ab.value.trim() || null,
        rubrica: tipo === 'aberta' ? f.rubrica.value.trim() || null : null, critica: f.critica.checked, ativa: f.ativa.checked };
      await run(q.id ? sb.from('questoes').update(row).eq('id', q.id) : sb.from('questoes').insert(row));
      dlg.close(); toast('Questão salva'); route();
    };
  });
  return d;
}

/* ============================ admin: turmas ============================ */
async function turmasView() {
  const ts = await run(sb.from('turmas').select('*,turma_membros(count)').order('nome'));
  shell(`<div class="row between"><h1>Turmas</h1><button class="pri" data-act="t-new">Nova turma</button></div>
    ${ts.length ? ts.map((t) => `<div class="card"><div class="row between"><div><h3>${esc(t.nome)}</h3><div class="muted small">${esc(t.descricao || '')} · ${t.turma_membros?.[0]?.count ?? 0} pessoa(s)</div></div>
      <div class="row"><button class="sm" data-act="t-edit" data-id="${t.id}">Gerenciar</button><button class="sm dan" data-act="t-del" data-id="${t.id}">Excluir</button></div></div></div>`).join('') : '<div class="card muted">Crie a primeira turma (ex.: “Consultoras PKB”, “Recepção Juvevê”).</div>'}`);
}

async function turmaDialog(id) {
  const [t, profs, mem] = await Promise.all([
    id ? run(sb.from('turmas').select('*').eq('id', id).single()) : Promise.resolve({}),
    run(sb.from('profiles').select('id,nome,email').eq('ativo', true).eq('role', 'colaborador').order('nome')),
    id ? run(sb.from('turma_membros').select('user_id').eq('turma_id', id)) : Promise.resolve([]),
  ]);
  const cur = new Set(mem.map((m) => m.user_id));
  openDialog(`<form id="tf"><h2>${id ? 'Gerenciar' : 'Nova'} turma</h2><label>Nome</label><input name="nome" required value="${esc(t.nome || '')}">
    <label>Descrição</label><input name="descricao" value="${esc(t.descricao || '')}"><label>Membros</label>
    <div class="scroll">${profs.length ? profs.map((p) => `<label class="chk"><input type="checkbox" value="${p.id}" ${cur.has(p.id) ? 'checked' : ''}> ${esc(p.nome || p.email)}</label>`).join('') : '<span class="muted small">Nenhum colaborador aprovado ainda.</span>'}</div>
    <div class="row" style="margin-top:1rem"><button class="pri" type="submit">Salvar</button><button type="button" data-close>Cancelar</button></div></form>`, (dlg) => {
    dlg.querySelector('#tf').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const row = { nome: f.nome.value.trim(), descricao: f.descricao.value.trim() || null };
      const tid = id || (await run(sb.from('turmas').insert(row).select('id').single())).id;
      if (id) await run(sb.from('turmas').update(row).eq('id', id));
      const want = new Set([...dlg.querySelectorAll('.scroll input:checked')].map((i) => i.value));
      const add = [...want].filter((x) => !cur.has(x)).map((user_id) => ({ turma_id: tid, user_id }));
      const rem = [...cur].filter((x) => !want.has(x));
      if (add.length) await run(sb.from('turma_membros').insert(add));
      if (rem.length) await run(sb.from('turma_membros').delete().eq('turma_id', tid).in('user_id', rem));
      dlg.close(); toast('Turma salva'); route();
    };
  });
}

/* ============================ admin: avaliações ============================ */
async function avaliacoesView() {
  const [avs, tents, links] = await Promise.all([
    run(sb.from('avaliacoes').select('*').order('created_at', { ascending: false })),
    run(sb.from('tentativas').select('avaliacao_id,status')),
    run(sb.from('avaliacao_turmas').select('avaliacao_id,turmas(nome,turma_membros(count))')),
  ]);
  shell(`<div class="row between"><h1>Avaliações</h1><button class="pri" data-act="a-new">Nova avaliação</button></div>
    ${avs.length ? avs.map((a) => {
      const ts = tents.filter((t) => t.avaliacao_id === a.id);
      const dest = links.filter((l) => l.avaliacao_id === a.id).reduce((s, l) => s + (l.turmas?.turma_membros?.[0]?.count || 0), 0);
      const env = ts.filter((t) => t.status !== 'em_andamento').length;
      return `<div class="card"><div class="row between"><div><h3>${esc(a.titulo)} ${statusPill(a.status)}</h3><div class="muted small">${a.mes ? esc(a.mes) + ' · ' : ''}prazo ${fmt(a.prazo)}${a.tempo_limite_min ? ` · ${a.tempo_limite_min} min` : ''}</div></div>
      ${a.status !== 'rascunho' ? `<div style="min-width:130px"><div class="small">${env}/${dest} enviaram</div>${bar(pct(env, dest))}</div>` : ''}</div>
      <div class="row" style="margin-top:.6rem">
        ${a.status === 'rascunho' ? `<button class="sm pri" data-act="a-pub" data-id="${a.id}">Publicar</button>` : ''}
        ${a.status === 'publicada' ? `<button class="sm" data-act="a-end" data-id="${a.id}">Encerrar</button>` : ''}
        <button class="sm" data-act="a-edit" data-id="${a.id}">Editar</button><button class="sm" data-act="a-dup" data-id="${a.id}">Duplicar p/ próximo mês</button>
        <button class="sm dan" data-act="a-del" data-id="${a.id}">Excluir</button></div></div>`;
    }).join('') : '<div class="card muted">Nenhuma avaliação ainda. Importe questões e crie a primeira.</div>'}`);
}

async function avaliacaoDialog(id) {
  const [a, qs, turmas, aq, at] = await Promise.all([
    id ? run(sb.from('avaliacoes').select('*').eq('id', id).single()) : Promise.resolve({}),
    run(sb.from('questoes').select('id,tipo,tema,enunciado,pontos,critica').eq('ativa', true).order('tema').range(0, 4999)),
    run(sb.from('turmas').select('id,nome').order('nome')),
    id ? run(sb.from('avaliacao_questoes').select('questao_id,ordem').eq('avaliacao_id', id)) : Promise.resolve([]),
    id ? run(sb.from('avaliacao_turmas').select('turma_id').eq('avaliacao_id', id)) : Promise.resolve([]),
  ]);
  const selQ = new Set(aq.map((x) => x.questao_id)), selT = new Set(at.map((x) => x.turma_id));
  const temas = [...new Set(qs.map((q) => q.tema))].sort();
  openDialog(`<form id="af2"><h2>${id ? 'Editar' : 'Nova'} avaliação</h2>
    <label>Título</label><input name="titulo" required value="${esc(a.titulo || '')}" placeholder="Ex.: Avaliação de Atendimento — Outubro">
    <div class="row"><div style="flex:1"><label>Mês de referência</label><input name="mes" type="month" value="${esc(a.mes || new Date().toISOString().slice(0, 7))}"></div>
    <div style="flex:1"><label>Prazo</label><input name="prazo" type="datetime-local" value="${toLocalInput(a.prazo)}"></div>
    <div style="width:130px"><label>Tempo (min)</label><input name="tempo" type="number" min="0" value="${a.tempo_limite_min ?? ''}" placeholder="sem limite"></div></div>
    <label>Instruções</label><textarea name="descricao">${esc(a.descricao || '')}</textarea>
    <label>Turmas destinatárias</label><div class="scroll">${turmas.length ? turmas.map((t) => `<label class="chk"><input type="checkbox" data-t value="${t.id}" ${selT.has(t.id) ? 'checked' : ''}> ${esc(t.nome)}</label>`).join('') : '<span class="muted small">Crie uma turma primeiro.</span>'}</div>
    <label>Questões <span id="qcount" class="muted"></span></label>
    <div class="row"><select id="qtema"><option value="">Todos os temas</option>${temas.map((t) => `<option>${esc(t)}</option>`).join('')}</select><button type="button" class="sm" id="qall">Marcar visíveis</button><button type="button" class="sm" id="qnone">Limpar</button></div>
    <div class="scroll" style="max-height:300px;margin-top:.4rem">${qs.map((q) => `<label class="chk" data-tema="${esc(q.tema)}"><input type="checkbox" data-q value="${q.id}" data-pts="${q.pontos}" ${selQ.has(q.id) ? 'checked' : ''}><span><span class="pill">${esc(q.tema)}</span> ${esc(q.enunciado.slice(0, 110))}${q.enunciado.length > 110 ? '…' : ''} <span class="muted small">(${num(q.pontos)} pt)</span></span></label>`).join('')}</div>
    <div class="row" style="margin-top:1rem"><button class="pri" type="submit">Salvar rascunho</button><button type="button" data-close>Cancelar</button></div></form>`, (dlg) => {
    const count = () => { const c = [...dlg.querySelectorAll('[data-q]:checked')]; dlg.querySelector('#qcount').textContent = `— ${c.length} selecionadas, ${num(c.reduce((s, i) => s + Number(i.dataset.pts), 0))} pontos`; };
    const vis = () => [...dlg.querySelectorAll('label[data-tema]')].filter((l) => !l.hidden);
    dlg.querySelector('#qtema').onchange = (e) => { dlg.querySelectorAll('label[data-tema]').forEach((l) => { l.hidden = e.target.value && l.dataset.tema !== e.target.value; }); };
    dlg.querySelector('#qall').onclick = () => { vis().forEach((l) => { l.querySelector('input').checked = true; }); count(); };
    dlg.querySelector('#qnone').onclick = () => { dlg.querySelectorAll('[data-q]').forEach((i) => { i.checked = false; }); count(); };
    dlg.addEventListener('change', count); count();
    dlg.querySelector('#af2').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const row = { titulo: f.titulo.value.trim(), mes: f.mes.value || null, prazo: f.prazo.value ? new Date(f.prazo.value).toISOString() : null, tempo_limite_min: f.tempo.value ? Number(f.tempo.value) : null, descricao: f.descricao.value.trim() || null };
      const aid = id || (await run(sb.from('avaliacoes').insert(row).select('id').single())).id;
      if (id) await run(sb.from('avaliacoes').update(row).eq('id', id));
      await run(sb.from('avaliacao_questoes').delete().eq('avaliacao_id', aid));
      await run(sb.from('avaliacao_turmas').delete().eq('avaliacao_id', aid));
      const qrows = [...dlg.querySelectorAll('[data-q]:checked')].map((i, n) => ({ avaliacao_id: aid, questao_id: i.value, ordem: n }));
      const trows = [...dlg.querySelectorAll('[data-t]:checked')].map((i) => ({ avaliacao_id: aid, turma_id: i.value }));
      if (qrows.length) await run(sb.from('avaliacao_questoes').insert(qrows));
      if (trows.length) await run(sb.from('avaliacao_turmas').insert(trows));
      dlg.close(); toast('Avaliação salva'); route();
    };
  });
}

/* ============================ admin: correções e feedback ============================ */
async function correcoesView() {
  const rows = await run(sb.from('tentativas').select('id,status,enviada_em,nota_total,nota_max,profiles(nome),avaliacoes(titulo)').neq('status', 'em_andamento').order('enviada_em', { ascending: false }).limit(80));
  const pend = rows.filter((r) => r.status === 'enviada'), ok = rows.filter((r) => r.status === 'corrigida');
  shell(`<h1>Correções</h1><h2>Aguardando correção (${pend.length})</h2>
    ${pend.length ? pend.map((r) => `<div class="card row between"><div><strong>${esc(r.profiles?.nome)}</strong><div class="muted small">${esc(r.avaliacoes?.titulo)} · enviada ${fmt(r.enviada_em)}</div></div><a class="btn pri sm" href="#/admin/corrigir/${r.id}">Corrigir</a></div>`).join('') : '<div class="card muted">Nada pendente. ✅</div>'}
    <h2>Corrigidas recentemente</h2>
    ${ok.length ? `<div class="card tbl"><table><thead><tr><th>Colaborador</th><th>Avaliação</th><th>Nota</th><th></th></tr></thead><tbody>${ok.map((r) => `<tr><td>${esc(r.profiles?.nome)}</td><td>${esc(r.avaliacoes?.titulo)}</td><td>${pct(r.nota_total, r.nota_max)}%</td>
      <td><a class="btn sm" href="#/resultado/${r.id}">Ver</a> <button class="sm" data-act="fb" data-id="${r.id}">Feedback</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="card muted">Sem correções ainda.</div>'}`);
}

async function corrigirView(tid) {
  const r = await run(sb.rpc('resultado_tentativa', { p_tentativa: tid }));
  const { data: prof } = await sb.from('profiles').select('nome').eq('id', r.tentativa.user_id).single();
  const abertas = r.itens.filter((q) => q.tipo === 'aberta');
  const objErr = r.itens.filter((q) => q.tipo !== 'aberta' && q.correta === false);
  shell(`<a href="#/admin/correcoes" class="small">← Voltar</a><h1>Corrigir: ${esc(prof?.nome)}</h1><p class="muted">${esc(r.avaliacao.titulo)} · objetivas: ${num(r.tentativa.nota_auto)} pts</p>
    ${objErr.length ? `<div class="card"><strong>Objetivas erradas (${objErr.length}):</strong> ${objErr.map((q) => `<span class="chip">${esc(q.tema)}${q.critica ? ' ⚠' : ''}</span>`).join('')}</div>` : ''}
    <form id="cf">${abertas.map((q, i) => `<div class="card q ${q.pontos == null ? 'pend' : 'ok'}"><div class="small muted">Aberta ${i + 1} · ${esc(q.tema)} ${q.critica ? '<span class="pill crit">crítica</span>' : ''}</div>
      <p><strong>${esc(q.enunciado)}</strong></p><p style="white-space:pre-wrap;background:var(--bg);padding:.6rem;border-radius:10px">${esc(q.resposta) || '<em class="muted">(em branco)</em>'}</p>
      ${q.gabarito ? `<div class="small"><b>Referência:</b> ${esc(q.gabarito)}</div>` : ''}${q.rubrica ? `<div class="small muted"><b>Rubrica:</b> ${esc(q.rubrica)}</div>` : ''}
      <div class="row"><div style="width:120px"><label>Pontos (0–${num(q.pontos_max)})</label><input type="number" min="0" max="${q.pontos_max}" step="0.5" data-qid="${q.questao_id}" value="${q.pontos ?? ''}" required></div>
      <div style="flex:1"><label>Comentário (aparece para o colaborador)</label><input data-cid="${q.questao_id}" value="${esc(q.comentario || '')}"></div></div></div>`).join('')}
      <div class="row"><button class="pri" type="submit">Salvar correção</button></div></form>`);
  document.getElementById('cf').onsubmit = async (e) => {
    e.preventDefault();
    const notas = [...e.target.querySelectorAll('[data-qid]')].map((i) => ({ questao_id: i.dataset.qid, pontos: Number(i.value), comentario: e.target.querySelector(`[data-cid="${i.dataset.qid}"]`).value }));
    await run(sb.rpc('corrigir_tentativa', { p_tentativa: tid, p_notas: notas }));
    toast('Correção salva e colaborador avisado');
    await feedbackDialog(tid);
    location.hash = '#/admin/correcoes';
  };
}

async function feedbackDialog(tid) {
  const r = await run(sb.rpc('resultado_tentativa', { p_tentativa: tid }));
  const t = r.tentativa;
  const { data: prof } = await sb.from('profiles').select('nome').eq('id', t.user_id).single();
  const byT = {};
  r.itens.forEach((q) => { if (q.pontos != null) { const o = (byT[q.tema] ||= { p: 0, m: 0 }); o.p += Number(q.pontos); o.m += Number(q.pontos_max); } });
  const arr = Object.entries(byT).map(([tema, o]) => ({ tema, p: pct(o.p, o.m) }));
  const fortes = arr.filter((x) => x.p >= 80).map((x) => `${x.tema} (${x.p}%)`);
  const fracos = arr.filter((x) => x.p < 70).sort((a, b) => a.p - b.p);
  const crit = r.itens.filter((q) => q.critica && (q.correta === false || (q.tipo === 'aberta' && Number(q.pontos) < Number(q.pontos_max) * 0.5)));
  let txt = `Olá, ${(prof?.nome || '').split(' ')[0]}! Seu resultado em "${r.avaliacao.titulo}": ${num(t.nota_total)}/${num(t.nota_max)} (${pct(t.nota_total, t.nota_max)}%).\n\n`;
  txt += fortes.length ? `Pontos fortes: ${fortes.join(', ')}.\n\n` : '';
  txt += fracos.length ? `Para reforçar: ${fracos.map((x) => `${x.tema} (${x.p}%)`).join(', ')}.\n\n` : 'Ótimo desempenho geral — mantenha o ritmo.\n\n';
  if (crit.length) txt += 'Atenção: houve falha em ponto crítico do atendimento. Vamos revisar juntos e fazer uma nova simulação prática.\n\n';
  txt += 'Próximo passo combinado: ';
  openDialog(`<form id="ff"><h2>Feedback para ${esc(prof?.nome)}</h2><p class="muted small">Rascunho gerado a partir do desempenho. Ajuste, inclua um exemplo/alternativa concreta e envie.</p>
    <label>Texto</label><textarea name="texto" style="min-height:240px" required>${esc(txt)}</textarea>
    <label>Temas de reforço</label><div>${fracos.map((x) => `<label class="chk" style="display:inline-flex;margin-right:1rem"><input type="checkbox" name="tema" value="${esc(x.tema)}" checked> ${esc(x.tema)}</label>`).join('') || '<span class="muted small">Nenhum</span>'}</div>
    <div class="row" style="margin-top:1rem"><button class="pri" type="submit">Enviar feedback</button><button type="button" data-close>Agora não</button></div></form>`, (dlg) => {
    dlg.querySelector('#ff').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      await run(sb.from('feedbacks').insert({ tentativa_id: tid, user_id: t.user_id, texto: f.texto.value.trim(), temas_reforco: [...f.querySelectorAll('[name=tema]:checked')].map((i) => i.value), created_by: me.id }));
      dlg.close(); toast('Feedback enviado');
    };
  });
  await new Promise((res) => document.querySelector('dialog:last-of-type')?.addEventListener('close', res, { once: true }));
}

/* ============================ admin: equipe e relatórios ============================ */
async function equipeView() {
  const [profs, tents] = await Promise.all([
    run(sb.from('profiles').select('*').order('nome')),
    run(sb.from('tentativas').select('user_id,nota_total,nota_max,status').eq('status', 'corrigida').range(0, 4999)),
  ]);
  const stat = (id) => { const t = tents.filter((x) => x.user_id === id); return { n: t.length, p: t.length ? Math.round(t.reduce((s, x) => s + pct(x.nota_total, x.nota_max), 0) / t.length) : null }; };
  const pend = profs.filter((p) => !p.ativo);
  shell(`<h1>Equipe</h1>
    ${pend.length ? `<h2>Aguardando aprovação</h2>${pend.map((p) => `<div class="card unread row between"><div><strong>${esc(p.nome || '—')}</strong><div class="muted small">${esc(p.email)}</div></div><div class="row"><button class="sm pri" data-act="p-ok" data-id="${p.id}">Aprovar</button><button class="sm dan" data-act="p-rej" data-id="${p.id}">Recusar</button></div></div>`).join('')}` : ''}
    <h2>Membros</h2><div class="card tbl"><table><thead><tr><th>Nome</th><th>Perfil</th><th>Provas</th><th>Média</th><th></th></tr></thead><tbody>
    ${profs.filter((p) => p.ativo).map((p) => { const s = stat(p.id); return `<tr><td><a href="#/admin/colab/${p.id}">${esc(p.nome || p.email)}</a><div class="muted small">${esc(p.email)}</div></td>
      <td><select data-act="p-role" data-id="${p.id}" ${p.id === me.id ? 'disabled' : ''} style="width:auto"><option value="colaborador" ${p.role === 'colaborador' ? 'selected' : ''}>Colaborador</option><option value="admin" ${p.role === 'admin' ? 'selected' : ''}>Admin</option></select></td>
      <td>${s.n}</td><td>${s.p == null ? '—' : bar(s.p) + `<span class="small">${s.p}%</span>`}</td>
      <td>${p.id === me.id ? '' : `<button class="sm dan" data-act="p-off" data-id="${p.id}">Desativar</button>`}</td></tr>`; }).join('')}</tbody></table></div>`);
}

async function colabData(uid) {
  const [prof, tents, temas, fbs] = await Promise.all([
    run(sb.from('profiles').select('*').eq('id', uid).single()),
    run(sb.from('tentativas').select('*,avaliacoes(titulo,mes)').eq('user_id', uid).neq('status', 'em_andamento').order('enviada_em')),
    run(sb.from('v_desempenho_user_tema').select('*').eq('user_id', uid)),
    run(sb.from('feedbacks').select('*').eq('user_id', uid).order('created_at', { ascending: false })),
  ]);
  return { prof, tents, temas, fbs };
}

async function colabView(uid) {
  const { prof, tents, temas, fbs } = await colabData(uid);
  const corr = tents.filter((t) => t.status === 'corrigida');
  const media = corr.length ? Math.round(corr.reduce((s, t) => s + pct(t.nota_total, t.nota_max), 0) / corr.length) : 0;
  const ult = corr.length ? pct(corr[corr.length - 1].nota_total, corr[corr.length - 1].nota_max) : 0;
  const ant = corr.length > 1 ? pct(corr[corr.length - 2].nota_total, corr[corr.length - 2].nota_max) : null;
  const delta = ant == null ? '' : ult - ant >= 0 ? `▲ ${ult - ant} pp` : `▼ ${Math.abs(ult - ant)} pp`;
  shell(`<a href="#/admin/equipe" class="small">← Equipe</a><div class="row between"><div><h1>${esc(prof.nome || prof.email)}</h1><div class="muted small">${esc(prof.email)}</div></div>
    <div class="row"><button data-act="colab-pdf" data-id="${uid}">PDF</button><button data-act="colab-csv" data-id="${uid}">CSV</button></div></div>
    <div class="grid g4"><div class="card kpi"><div class="v">${corr.length}</div><div class="l">avaliações corrigidas</div></div><div class="card kpi"><div class="v">${media}%</div><div class="l">média</div></div>
    <div class="card kpi"><div class="v">${ult}%</div><div class="l">última ${delta ? '· ' + delta : ''}</div></div></div>
    <div class="grid g2"><div class="card"><h3>Por tema</h3>${temas.length ? [...temas].sort((a, b) => pct(a.pontos, a.pontos_max) - pct(b.pontos, b.pontos_max)).map((x) => { const p = pct(x.pontos, x.pontos_max); return `<div class="row between small"><span>${esc(x.tema)}</span><span>${p}%</span></div>${bar(p)}`; }).join('') : '<p class="muted">Sem dados.</p>'}</div>
    <div class="card"><h3>Feedbacks enviados</h3>${fbs.length ? fbs.slice(0, 4).map((f) => `<p class="small"><span class="muted">${fmt(f.created_at)} ${f.lido ? '· lido' : '· não lido'}</span><br>${esc(f.texto.slice(0, 160))}…</p>`).join('') : '<p class="muted">Nenhum ainda.</p>'}</div></div>
    <div class="card tbl"><h3>Histórico</h3><table><thead><tr><th>Avaliação</th><th>Mês</th><th>Nota</th><th>Status</th><th></th></tr></thead><tbody>
    ${tents.map((t) => `<tr><td>${esc(t.avaliacoes?.titulo)}</td><td>${esc(t.avaliacoes?.mes || '')}</td><td>${t.status === 'corrigida' ? `${num(t.nota_total)}/${num(t.nota_max)} (${pct(t.nota_total, t.nota_max)}%)` : '—'}</td><td>${statusPill(t.status)}</td>
    <td><a class="btn sm" href="#/resultado/${t.id}">Detalhe</a> <button class="sm" data-act="pdf-tentativa" data-id="${t.id}">PDF</button> ${t.status === 'corrigida' ? `<button class="sm" data-act="fb" data-id="${t.id}">Feedback</button>` : `<a class="btn sm pri" href="#/admin/corrigir/${t.id}">Corrigir</a>`}</td></tr>`).join('')}</tbody></table></div>`);
}

/* ============================ push ============================ */
const b64 = (s) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };
async function ativarPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return toast('Push indisponível aqui. No iPhone, instale o app na Tela de Início.', true);
  if (await Notification.requestPermission() !== 'granted') return toast('Permissão negada no navegador', true);
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC_KEY) }));
  const j = sub.toJSON();
  await run(sb.from('push_subscriptions').upsert({ user_id: me.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' }));
  toast('Notificações ativadas neste aparelho');
}

/* ============================ ações (delegação de eventos) ============================ */
const actions = {
  logout,
  push: ativarPush,
  async iniciar(el) { const id = await run(sb.rpc('iniciar_tentativa', { p_avaliacao: el.dataset.id })); location.hash = '#/prova/' + id; },
  async lerTodas() { await run(sb.from('notificacoes').update({ lida: true }).eq('user_id', me.id).eq('lida', false)); route(); },
  async lida(el) { await sb.from('notificacoes').update({ lida: true }).eq('id', el.dataset.id); },
  'q-new': () => questaoDialog(),
  'q-edit': (el) => questaoDialog(QCACHE.find((q) => q.id === el.dataset.id)),
  async 'q-del'(el) {
    if (!confirm('Excluir esta questão? Se já foi usada em avaliações, prefira desativá-la.')) return;
    const { error } = await sb.from('questoes').delete().eq('id', el.dataset.id);
    if (error) return toast('Não foi possível excluir (questão em uso). Desative-a ao editar.', true);
    route();
  },
  'q-import': () => document.getElementById('qfile').click(),
  'q-export': () => download('kaizen-questoes.json', JSON.stringify({ questoes: QCACHE.map(({ id, created_at, ...q }) => q) }, null, 2), 'application/json'),
  't-new': () => turmaDialog(),
  't-edit': (el) => turmaDialog(el.dataset.id),
  async 't-del'(el) { if (confirm('Excluir esta turma?')) { await run(sb.from('turmas').delete().eq('id', el.dataset.id)); route(); } },
  'a-new': () => avaliacaoDialog(),
  'a-edit': (el) => avaliacaoDialog(el.dataset.id),
  async 'a-pub'(el) { if (!confirm('Publicar e avisar todos os destinatários?')) return; const n = await run(sb.rpc('publicar_avaliacao', { p_id: el.dataset.id })); toast(`Publicada — ${n} pessoa(s) avisada(s)`); route(); },
  async 'a-end'(el) { if (!confirm('Encerrar? O gabarito das objetivas será liberado aos colaboradores.')) return; await run(sb.from('avaliacoes').update({ status: 'encerrada' }).eq('id', el.dataset.id)); route(); },
  async 'a-del'(el) { if (confirm('Excluir esta avaliação e todos os resultados?')) { await run(sb.from('avaliacoes').delete().eq('id', el.dataset.id)); route(); } },
  async 'a-dup'(el) {
    const id = el.dataset.id;
    const [a, aq, at] = await Promise.all([run(sb.from('avaliacoes').select('*').eq('id', id).single()), run(sb.from('avaliacao_questoes').select('*').eq('avaliacao_id', id)), run(sb.from('avaliacao_turmas').select('*').eq('avaliacao_id', id))]);
    const nid = (await run(sb.from('avaliacoes').insert({ titulo: a.titulo + ' (cópia)', mes: nextMonth(), descricao: a.descricao, tempo_limite_min: a.tempo_limite_min }).select('id').single())).id;
    if (aq.length) await run(sb.from('avaliacao_questoes').insert(aq.map((x) => ({ ...x, avaliacao_id: nid }))));
    if (at.length) await run(sb.from('avaliacao_turmas').insert(at.map((x) => ({ ...x, avaliacao_id: nid }))));
    toast('Rascunho criado para o próximo mês'); route();
  },
  fb: (el) => feedbackDialog(el.dataset.id),
  async 'p-ok'(el) { await run(sb.from('profiles').update({ ativo: true }).eq('id', el.dataset.id)); toast('Acesso aprovado'); route(); },
  async 'p-rej'(el) { if (confirm('Recusar este cadastro? A conta continuará sem acesso.')) toast('Cadastro mantido sem acesso'); },
  async 'p-off'(el) { if (confirm('Desativar o acesso desta pessoa?')) { await run(sb.from('profiles').update({ ativo: false }).eq('id', el.dataset.id)); route(); } },
  async 'p-role'(el) { await run(sb.from('profiles').update({ role: el.value }).eq('id', el.dataset.id)); toast('Perfil atualizado'); },
  async 'pdf-tentativa'(el) {
    const r = await run(sb.rpc('resultado_tentativa', { p_tentativa: el.dataset.id }));
    const { data: prof } = await sb.from('profiles').select('nome').eq('id', r.tentativa.user_id).single();
    const t = r.tentativa;
    const rows = r.itens.map((q, i) => [i + 1, q.tema, q.enunciado, q.resposta ? (q.tipo === 'multipla' ? q.resposta : q.resposta.slice(0, 300)) : '(branco)', q.gabarito != null && q.tipo !== 'aberta' ? q.gabarito : '', q.pontos == null ? 'pend.' : `${num(q.pontos)}/${num(q.pontos_max)}`]);
    pdf(`Kaizen — ${r.avaliacao.titulo}`, `${prof?.nome || ''} · ${t.status === 'corrigida' ? `${num(t.nota_total)}/${num(t.nota_max)} (${pct(t.nota_total, t.nota_max)}%)` : 'aguardando correção'} · ${fmt(t.enviada_em)}`, ['#', 'Tema', 'Questão', 'Resposta', 'Gabarito', 'Pts'], rows, `kaizen-${(prof?.nome || 'resultado').replace(/\s+/g, '-').toLowerCase()}.pdf`);
  },
  async 'colab-pdf'(el) {
    const { prof, tents } = await colabData(el.dataset.id);
    pdf(`Kaizen — Relatório de ${prof.nome || prof.email}`, `Gerado em ${fmt(new Date())}`, ['Avaliação', 'Mês', 'Nota', '%', 'Status'], tents.map((t) => [t.avaliacoes?.titulo, t.avaliacoes?.mes || '', t.status === 'corrigida' ? `${num(t.nota_total)}/${num(t.nota_max)}` : '—', t.status === 'corrigida' ? pct(t.nota_total, t.nota_max) + '%' : '—', t.status]), `kaizen-relatorio-${(prof.nome || 'colab').replace(/\s+/g, '-').toLowerCase()}.pdf`);
  },
  async 'colab-csv'(el) {
    const { prof, tents } = await colabData(el.dataset.id);
    csv(`kaizen-${(prof.nome || 'colab').replace(/\s+/g, '-').toLowerCase()}.csv`, [['Avaliação', 'Mês', 'Nota', 'Máximo', '%', 'Status', 'Enviada em'], ...tents.map((t) => [t.avaliacoes?.titulo, t.avaliacoes?.mes, t.nota_total, t.nota_max, t.status === 'corrigida' ? pct(t.nota_total, t.nota_max) : '', t.status, fmt(t.enviada_em)])]);
  },
  async 'export-equipe-pdf'() { const rows = await teamRows(); pdf('Kaizen — Desempenho da equipe', `Gerado em ${fmt(new Date())}`, ['Colaborador', 'Provas', 'Média %', 'Última %'], rows.map((r) => [r.nome, r.n, r.media, r.ultima]), 'kaizen-equipe.pdf'); },
  async 'export-equipe-csv'() { const rows = await teamRows(); csv('kaizen-equipe.csv', [['Colaborador', 'E-mail', 'Provas', 'Média %', 'Última %'], ...rows.map((r) => [r.nome, r.email, r.n, r.media, r.ultima])]); },
};
async function teamRows() {
  const [profs, tents] = await Promise.all([
    run(sb.from('profiles').select('id,nome,email').eq('ativo', true).eq('role', 'colaborador').order('nome')),
    run(sb.from('tentativas').select('user_id,nota_total,nota_max,enviada_em').eq('status', 'corrigida').order('enviada_em').range(0, 4999)),
  ]);
  return profs.map((p) => {
    const t = tents.filter((x) => x.user_id === p.id);
    return { nome: p.nome || p.email, email: p.email, n: t.length, media: t.length ? Math.round(t.reduce((s, x) => s + pct(x.nota_total, x.nota_max), 0) / t.length) : '—', ultima: t.length ? pct(t[t.length - 1].nota_total, t[t.length - 1].nota_max) : '—' };
  });
}

document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'SELECT' || !actions[el.dataset.act]) return;
  try { await actions[el.dataset.act](el, e); } catch (err) { console.error(err); }
});
document.addEventListener('change', async (e) => {
  const el = e.target;
  if (el.tagName === 'SELECT' && el.dataset.act && actions[el.dataset.act]) { try { await actions[el.dataset.act](el, e); } catch (err) { console.error(err); } }
});

/* ============================ boot ============================ */
async function boot() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return authView();
  me = await run(sb.from('profiles').select('*').eq('id', session.user.id).single());
  if (!me.ativo) {
    app.innerHTML = `<main><div class="card auth"><h1>Kaizen</h1><p>Olá, ${esc(me.nome)}! Sua conta foi criada e está <strong>aguardando aprovação</strong> de um administrador.</p><button data-act="logout">Sair</button></div></main>`;
    return;
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  sb.channel('notif-' + me.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `user_id=eq.${me.id}` }, (p) => {
    toast(`${p.new.titulo}${p.new.corpo ? ' — ' + p.new.corpo : ''}`);
    // não recarrega a tela durante uma prova em andamento
    if (!(location.hash || '').startsWith('#/prova')) route();
  }).subscribe();
  route();
}

window.addEventListener('hashchange', route);
sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_OUT') { me = null; authView(); } if (ev === 'PASSWORD_RECOVERY') { const p = prompt('Nova senha (mín. 8 caracteres):'); if (p) sb.auth.updateUser({ password: p }).then(({ error }) => toast(error ? error.message : 'Senha atualizada', !!error)); } });
boot();
