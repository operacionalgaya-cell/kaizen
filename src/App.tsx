import React, { useEffect, useState, useCallback } from 'react';
import { sb } from './lib/supabase';
import { AppProvider, useApp, useHash, Me, go } from './lib/app';
import { Loading } from './lib/ui';
import { Header } from './pages/Header';
import { Auth, Pending } from './pages/Auth';
import { Home } from './pages/Home';
import { Prova } from './pages/Prova';
import { Resultado } from './pages/Resultado';
import { Notificacoes } from './pages/Notificacoes';
import { Playbook } from './pages/Playbook';
import { KaizenColab, KaizenNovo, KaizenVer } from './pages/KaizenColab';
import { Painel } from './pages/admin/Painel';
import { Questoes } from './pages/admin/Questoes';
import { Turmas } from './pages/admin/Turmas';
import { Avaliacoes } from './pages/admin/Avaliacoes';
import { Correcoes, Corrigir } from './pages/admin/Correcoes';
import { Equipe, Colab } from './pages/admin/Equipe';
import { KaizenAdmin } from './pages/admin/KaizenAdmin';
import { Config } from './pages/admin/Config';

function Router() {
  const { me } = useApp();
  const path = useHash();
  const p = path.split('/').filter(Boolean);
  const admin = me!.role === 'admin';
  let view: React.ReactNode;
  if (p[0] === 'admin') {
    if (!admin) view = <Home />;
    else switch (p[1]) {
      case 'questoes': view = <Questoes />; break;
      case 'turmas': view = <Turmas />; break;
      case 'avaliacoes': view = <Avaliacoes />; break;
      case 'correcoes': view = <Correcoes />; break;
      case 'corrigir': view = <Corrigir id={p[2]} />; break;
      case 'equipe': view = <Equipe />; break;
      case 'colab': view = <Colab id={p[2]} />; break;
      case 'kaizen': view = <KaizenAdmin openId={p[2]} />; break;
      case 'config': view = <Config />; break;
      default: view = <Painel />;
    }
  } else switch (p[0]) {
    case 'prova': view = <Prova id={p[1]} />; break;
    case 'resultado': view = <Resultado id={p[1]} />; break;
    case 'avisos': view = <Notificacoes />; break;
    case 'playbook': view = <Playbook />; break;
    case 'kaizen': view = p[1] === 'novo' ? <KaizenNovo /> : p[1] ? <KaizenVer id={p[1]} /> : <KaizenColab />; break;
    default: view = admin && !p[0] ? <Painel /> : <Home />;
  }
  return <><Header />{view}</>;
}

function Gate() {
  const { me } = useApp();
  if (!me) return <Auth />;
  if (!me.ativo) return <Pending />;
  return <Router />;
}

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const load = useCallback(async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { setMe(null); setReady(true); return; }
    const { data } = await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
    setMe(data as Me | null); setReady(true);
  }, []);
  useEffect(() => {
    load();
    const { data: sub } = sb.auth.onAuthStateChange((ev) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT' || ev === 'TOKEN_REFRESHED') load(); });
    return () => sub.subscription.unsubscribe();
  }, []);
  if (!ready) return <Loading />;
  return <AppProvider me={me} reloadMe={load}><Gate /></AppProvider>;
}
