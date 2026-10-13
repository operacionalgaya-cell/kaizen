import React, { useState } from 'react';
import { sb } from '../lib/supabase';
import { useApp } from '../lib/app';

export function Auth() {
  const { toast } = useApp();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ nome: '', email: '', senha: '' });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await sb.auth.signInWithPassword({ email: f.email.trim(), password: f.senha });
        if (error) throw error;
      } else if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({ email: f.email.trim(), password: f.senha, options: { data: { nome: f.nome.trim() }, emailRedirectTo: location.origin } });
        if (error) throw error;
        if (!data.session) toast('Cadastro criado. Confirme o e-mail (se solicitado) e aguarde a aprovação da coordenação.');
      } else {
        const { error } = await sb.auth.resetPasswordForEmail(f.email.trim(), { redirectTo: location.origin });
        if (error) throw error;
        toast('Enviamos o link de redefinição para o seu e-mail.'); setMode('login');
      }
    } catch (err: any) { toast(err.message === 'Invalid login credentials' ? 'E-mail ou senha incorretos' : err.message, true); }
    finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen grid place-items-center bg-stone-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="font-serif-display text-5xl text-amber-200">Kaizen</div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-400 mt-1">Gaya Bem-Estar · Jeito Gaya de Encantar e Vender</p>
        </div>
        <form onSubmit={submit} className="bg-white rounded-xl p-6 shadow-2xl">
          <h1 className="text-2xl font-semibold">{mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Redefinir senha'}</h1>
          {mode === 'signup' && <><label className="lbl">Nome completo</label><input className="inp" required value={f.nome} onChange={set('nome')} autoComplete="name" /></>}
          <label className="lbl">E-mail</label><input className="inp" type="email" required value={f.email} onChange={set('email')} autoComplete="email" />
          {mode !== 'reset' && <><label className="lbl">Senha</label><input className="inp" type="password" required minLength={8} value={f.senha} onChange={set('senha')} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></>}
          <button className="btn-pri w-full mt-5 !py-2.5" disabled={busy}>{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : mode === 'signup' ? 'Criar conta' : 'Enviar link'}</button>
          <div className="mt-4 flex justify-between text-xs text-stone-500">
            {mode === 'login' ? <><button type="button" className="hover:text-stone-900 underline" onClick={() => setMode('signup')}>Criar conta</button><button type="button" className="hover:text-stone-900 underline" onClick={() => setMode('reset')}>Esqueci a senha</button></> : <button type="button" className="hover:text-stone-900 underline" onClick={() => setMode('login')}>Voltar ao login</button>}
          </div>
          {mode === 'signup' && <p className="text-[11px] text-stone-500 mt-3">Novos cadastros precisam ser aprovados pela coordenação antes do primeiro acesso.</p>}
        </form>
      </div>
    </div>
  );
}

export function Pending() {
  const { me, reloadMe } = useApp();
  return (
    <div className="min-h-screen grid place-items-center bg-stone-900 px-4">
      <div className="bg-white rounded-xl p-8 max-w-sm text-center shadow-2xl">
        <div className="font-serif-display text-4xl text-amber-800">Quase lá</div>
        <p className="text-sm text-stone-600 mt-3">Olá{me?.nome ? `, ${me.nome.split(' ')[0]}` : ''}! Seu cadastro está <strong>aguardando aprovação</strong> da coordenação. Você receberá acesso assim que for liberado.</p>
        <div className="flex gap-2 justify-center mt-5">
          <button className="btn" onClick={reloadMe}>Verificar novamente</button>
          <button className="btn" onClick={() => sb.auth.signOut()}>Sair</button>
        </div>
      </div>
    </div>
  );
}
