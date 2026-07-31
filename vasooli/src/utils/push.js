import { supabase } from '../supabaseClient'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

/** Web Push needs the VAPID key as a Uint8Array, not the base64 string. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

/**
 * Returns why push isn't available, or null if it is.
 * iOS only allows push for PWAs added to the home screen -- not in a Safari tab.
 */
export function pushBlockedReason() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return 'This browser doesn\'t support notifications.'
  }
  if (isIOS() && !isStandalone()) {
    return 'On iPhone, add Vasooli to your home screen first (Share → Add to Home Screen), then open it from there.'
  }
  if (!VAPID_PUBLIC_KEY) {
    return 'Notifications aren\'t configured for this deployment yet.'
  }
  return null
}

export async function getExistingSubscription() {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

/**
 * Must be called directly from a click handler -- iOS silently ignores
 * permission requests that aren't tied to a user gesture.
 */
export async function subscribeToPush(profileId) {
  const blocked = pushBlockedReason()
  if (blocked) throw new Error(blocked)

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notifications were declined. You can re-enable them in your browser settings.')
  }

  const reg = await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })
  }

  const json = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      profile_id: profileId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
    },
    { onConflict: 'endpoint' }
  )
  if (error) throw new Error(error.message)
  return sub
}

export async function unsubscribeFromPush() {
  const sub = await getExistingSubscription()
  if (!sub) return
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
}

/**
 * Asks the server to notify everyone else in the group.
 * Fire-and-forget: a failed notification should never block saving an expense.
 */
export function notifyGroup({ groupId, actorId, title, body }) {
  fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, actorId, title, body }),
  }).catch(() => {})
}
