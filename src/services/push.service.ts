import { arrayBufferToBase64, urlBase64ToUint8Array } from '../lib/pushHelpers';
import { supabase } from '../lib/supabase';

export interface PushStatus {
  supported: boolean;
  permission: NotificationPermission;
  active: boolean;
  reason?: string;
}

function isAppleMobile() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function getAppleMobileVersion() {
  if (!isAppleMobile()) return null;

  const match = navigator.userAgent.match(/OS (\d+)[._](\d+)/i);
  if (!match) return null;

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
  };
}

function isStandalonePwa() {
  if (typeof window === 'undefined') return false;

  const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || standaloneNavigator.standalone === true;
}

function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function getUnsupportedReason() {
  if (isAppleMobile()) {
    const version = getAppleMobileVersion();

    if (version && (version.major < 16 || (version.major === 16 && version.minor < 4))) {
      return 'No iPhone e iPad, notificacoes push para PWA exigem iOS ou iPadOS 16.4 ou superior.';
    }

    if (!isStandalonePwa()) {
      return 'No iPhone e iPad, abra o app instalado pela Tela de Inicio para ativar notificacoes push.';
    }
  }

  return 'Seu navegador nao suporta notificacoes push.';
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
      reason: getUnsupportedReason(),
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
    throw new Error(getUnsupportedReason());
  }

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  if (!vapidKey) {
    throw new Error('Chave publica VAPID nao configurada.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permissao negada nas configuracoes do navegador. Habilite para receber notificacoes.');
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
    throw new Error('Nao foi possivel registrar notificacoes neste navegador.');
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
