import React from 'react';
import { BellRing } from 'lucide-react';
import { sb } from '../lib/supabase';
import { useApp, useAsync, run } from '../lib/app';
import { VAPID_PUBLIC_KEY } from '../config';
import { Loading, ErrorBox, Page, Empty } from '../lib/ui';
import { fmt } from '../lib/util';

const b64 = (s: string) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map((c) => c.charCodeAt(0))); };

export function Notificacoes() {
  const { me, toast, refreshUnread } = useApp();
  const { data, err, loading, reload } = useAsync(() => run(sb.from('notificacoes').select('*').eq('user_id', me!.id).order('created_at', { ascending: false }).limit(60)), []);
  const pushOk = 'serviceWorker' in navigator && 'PushManager' in window;
  const ativar = async () => {
    try {
      if (!pushOk) return toast('Push indisponível aqui. No iPhone, instale o app na Tela de Início.', true);
      if (!VAPID_PUBLIC_KEY) return toast('Chave VAPID ainda não configurada (VITE_VAPID_PUBLIC_KEY).', true);
      if ((await Notification.requestPermission()) !== 'granted') return toast('Permissão negada no navegador', true);
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC_KEY) }));
      const j: any = sub.toJSON();
      await run(sb.from('push_subscriptions').upsert({ user_id: me!.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: 'endpoint' }));
      toast('Notificações ativadas neste aparelho');
    } catch (e: any) { toast(e.message, true); }
  };
  const lerTodas = async () => { await sb.from('notificacoes').update({ lida: true }).eq('user_id', me!.id).eq('lida', false); reload(); refreshUnread(); };
  if (loading) return <Loading />;
  if (err) return <ErrorBox msg={err} />;
  return (
    <Page title="Avisos" actions={<><button className="btn" onClick={ativar}><BellRing className="w-3.5 h-3.5" />Ativar notificações push</button><button className="btn" onClick={lerTodas}>Marcar todas como lidas</button></>}>
      {!pushOk && <p className="text-xs text-stone-500">Push indisponível neste navegador. No iPhone: Compartilhar → Adicionar à Tela de Início e abra por lá.</p>}
      {data!.length ? <div className="space-y-2">{data!.map((n: any) => (
        <a key={n.id} href={n.url || '#/'} onClick={async () => { await sb.from('notificacoes').update({ lida: true }).eq('id', n.id); refreshUnread(); }}
          className={`card block !p-4 hover:shadow-md transition-shadow ${n.lida ? '' : '!border-amber-300 !bg-amber-50/60'}`}>
          <strong className="text-sm">{n.titulo}</strong><div className="text-sm text-stone-600">{n.corpo}</div><div className="text-[11px] text-stone-400 font-mono mt-1">{fmt(n.created_at)}</div></a>))}</div> : <Empty text="Nenhum aviso por enquanto." />}
    </Page>
  );
}
