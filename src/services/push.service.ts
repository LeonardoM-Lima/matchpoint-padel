import { arrayBufferToBase64, urlBase64ToUint8Array } from '../lib/pushHelpers';
import { supabase } from '../lib/supabase';

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission;
  active: boolean;
  reason?: string;
}

function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function getCurrentSubscription() {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export async function getPushStatus(profileId: string): Promise<PushStatus> {
  if (!isPushSupported()) {
    return {
      supported: false,
      permission: 'default',
      active: false,
      reason: 'Seu navegador não suporta notificações push',
    };
  }

  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id')
    .eq('profile_id', profileId)
    .limit(1);

  if (error) throw error;

  return {
    supported: true,
    permission: Notification.permission,
    active: (data ?? []).length > 0,
  };
}

export async function subscribePush(profileId: string) {
  if (!isPushSupported()) {
    throw new Error('Seu navegador não suporta notificações push');
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    throw new Error('Chave pública VAPID não configurada.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissão negada nas configurações do navegador. Habilite para receber notificações.');
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing ?? await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidKey),
  });

  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);

  const p256dh = subscription.getKey('p256dh');
  const auth = subscription.getKey('auth');

  if (!p256dh || !auth) {
    throw new Error('Não foi possível registrar notificações neste navegador.');
  }

  const { error } = await supabase.from('push_subscriptions').insert({
    profile_id: profileId,
    endpoint: subscription.endpoint,
    p256dh: arrayBufferToBase64(p256dh),
    auth: arrayBufferToBase64(auth),
    user_agent: navigator.userAgent,
  });

  if (error) throw error;
}

export async function unsubscribePush(profileId: string) {
  if (!isPushSupported()) return;

  const subscription = await getCurrentSubscription();
  if (subscription) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    await subscription.unsubscribe();
    return;
  }

  await supabase.from('push_subscriptions').delete().eq('profile_id', profileId);
}
