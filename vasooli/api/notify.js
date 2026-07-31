// Vercel serverless function: sends a push notification to everyone in a group
// except the person who triggered it.
//
// Runs on Vercel's servers, never in the browser -- which is why it can safely
// use the Supabase service role key to read other people's push subscriptions.
//
// Required environment variables (set these in Vercel, never in the code):
//   VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY
//   VAPID_SUBJECT              e.g. mailto:you@example.com
//   SUPABASE_URL               same as VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  the secret one -- server-side only

import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const {
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
    VAPID_SUBJECT,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env

  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // Not configured yet -- succeed quietly so the app keeps working without push.
    return res.status(200).json({ sent: 0, skipped: 'not_configured' })
  }

  const { groupId, actorId, title, body } = req.body || {}
  if (!groupId || !title) {
    return res.status(400).json({ error: 'Missing groupId or title' })
  }

  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:noreply@vasooli.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Who's in this group (excluding whoever triggered the notification)?
  const { data: members, error: memberError } = await supabase
    .from('group_members')
    .select('profile_id')
    .eq('group_id', groupId)

  if (memberError) {
    return res.status(500).json({ error: memberError.message })
  }

  const recipientIds = (members || [])
    .map((m) => m.profile_id)
    .filter((id) => id !== actorId)

  if (recipientIds.length === 0) {
    return res.status(200).json({ sent: 0 })
  }

  const { data: subs, error: subError } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key')
    .in('profile_id', recipientIds)

  if (subError) {
    return res.status(500).json({ error: subError.message })
  }

  const payload = JSON.stringify({ title, body: body || '', url: '/' })
  const staleEndpoints = []

  await Promise.all(
    (subs || []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth_key },
          },
          payload
        )
      } catch (err) {
        // 404/410 mean the subscription is dead (app uninstalled, permission revoked).
        if (err.statusCode === 404 || err.statusCode === 410) {
          staleEndpoints.push(sub.endpoint)
        }
      }
    })
  )

  // Clean up dead subscriptions so they don't pile up.
  if (staleEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints)
  }

  return res.status(200).json({
    sent: (subs || []).length - staleEndpoints.length,
    cleaned: staleEndpoints.length,
  })
}
