import React, { useState } from 'react';
import { Bell, LogOut, Menu, X } from 'lucide-react';
import { useApp, useHash, go } from '../lib/app';
import { sb } from '../lib/supabase';

const COLAB = [['/', 'Meu painel'], ['/kaizen', 'Kaizen Gaya'], ['/playbook', 'Playbook'], ['/avisos', 'Avisos']];
const ADMIN = [['/admin', 'Painel'], ['/admin/correcoes', 'Correções'], ['/admin/kaizen', 'Kaizen Gaya'], ['/admin/avaliacoes', 'Avaliações'], ['/admin/questoes', 'Questões'], ['/admin/turmas', 'Turmas'], ['/admin/equipe', 'Equipe'], ['/playbook', 'Playbook'], ['/admin/config', 'Ajustes']];

export function Header() {
  const { me, unread } = useApp();
  const path = useHash();
  const [open, setOpen] = useState(false);
  const admin = me!.role === 'admin';
  const links = admin ? ADMIN : COLAB;
  const active = (to: string) => (to === '/' || to === '/admin' ? path === to || (admin && to === '/admin' && path === '/') : path.startsWith(to));
  const out = async () => { await sb.auth.signOut(); location.hash = '#/'; };
  const Item = ({ to, label }: { to: string; label: string }) => (
    <a href={'#' + to} onClick={() => setOpen(false)} className={`whitespace-nowrap text-[13px] lg:text-sm font-medium transition-colors ${active(to) ? 'text-amber-300 font-semibold md:border-b-2 border-amber-300 pb-0.5' : 'text-stone-300 hover:text-white'}`}>{label}</a>
  );
  return (
    <header className="sticky top-0 z-50 bg-stone-900 text-stone-100 border-b border-stone-800 shadow-sm no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 h-16">
        <a href={admin ? '#/admin' : '#/'} className="shrink-0">
          <span className="font-serif-display text-2xl tracking-wide text-amber-200">Kaizen</span>
          <span className="hidden xl:inline ml-3 text-[11px] text-stone-400 font-medium tracking-wider uppercase">Gaya Bem-Estar · Jeito Gaya</span>
        </a>
        <nav className="hidden md:flex items-center gap-4 lg:gap-5">{links.map(([to, l]) => <Item key={to} to={to} label={l} />)}</nav>
        <div className="flex items-center gap-2">
          <a href="#/avisos" aria-label="Avisos" className="relative p-2 text-stone-300 hover:text-white">
            <Bell className="w-5 h-5" />
            {unread > 0 && <span className="absolute top-0.5 right-0 min-w-4 h-4 px-1 rounded-full bg-amber-400 text-stone-900 text-[10px] font-bold flex items-center justify-center">{unread}</span>}
          </a>
          <button onClick={out} aria-label="Sair" title={`Sair (${me!.nome || me!.email})`} className="p-2 text-stone-300 hover:text-white"><LogOut className="w-5 h-5" /></button>
          <button onClick={() => setOpen(!open)} aria-label="Menu" className="md:hidden p-2 text-stone-300">{open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}</button>
        </div>
      </div>
      {open && <nav className="md:hidden border-t border-stone-800 px-4 py-3 grid grid-cols-2 gap-3">{links.map(([to, l]) => <Item key={to} to={to} label={l} />)}</nav>}
    </header>
  );
}
