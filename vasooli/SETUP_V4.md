# Updating to v4 — invite links & notifications

Two features here, and they have very different setup effort.
**Invite links work after step 1. Notifications need steps 3–5**, which are more
involved — you can skip them and add notifications later without breaking anything.

---

## 1. Run the migration (required)

Supabase → SQL Editor → New query → paste all of `migration_v4.sql` → Run.

Additive only. Your existing groups, expenses and accounts are untouched.

## 2. Push the code to GitHub (required)

Same as always — upload into the `vasooli` folder Vercel points at.

**New this time:** there's an `api/` folder. Make sure it uploads too — that's
the piece that actually sends notifications. Without it, everything else still
works, notifications just silently don't fire.

At this point **invite links are live.** Open any group → ⋮ menu → *Invite people*.

---

## 3. Generate notification keys (optional — only for notifications)

Web Push needs a keypair that identifies your app to Apple/Google's notification
servers. Generate your own:

```bash
npx web-push generate-vapid-keys
```

That prints a **Public Key** and a **Private Key**. Keep them somewhere safe for
the next step. Don't commit them to GitHub, and don't paste the private key into
a chat — it belongs only in Vercel's environment variables.

*(No terminal? You can skip notifications entirely for now — the app detects
they're unconfigured and hides the toggle rather than erroring.)*

## 4. Add environment variables in Vercel

Vercel → your project → **Settings → Environment Variables**. Add five:

| Name | Value |
|---|---|
| `VITE_VAPID_PUBLIC_KEY` | the Public Key from step 3 |
| `VAPID_PUBLIC_KEY` | the same Public Key again |
| `VAPID_PRIVATE_KEY` | the Private Key from step 3 |
| `VAPID_SUBJECT` | `mailto:youremail@example.com` |
| `SUPABASE_URL` | same value as your existing `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | see the warning below |

The public key appears twice on purpose — the browser needs `VITE_`-prefixed
variables, the server function needs the plain one.

> **About the service role key:** Supabase → Settings → API Keys → *Secret keys*.
> This one bypasses every security rule in your database. It's safe here because
> Vercel environment variables are only readable by your server-side function,
> never sent to browsers — but never put it in your code, your repo, or a chat.

After adding them, **redeploy** (Vercel → Deployments → ⋯ → Redeploy) so the new
variables take effect.

## 5. Turn notifications on, per person

Each person: Profile (top-right icon) → Notifications → *Turn on notifications*.

**iPhone users must add Vasooli to their home screen first.** Apple only allows
web notifications for home-screen apps, never from a Safari tab. The app detects
this and shows instructions instead of a broken button.

---

## How invite links work

**⋮ menu → Invite people** gives you a link to share. Optionally set a **4-digit
code** that people must also enter to join.

The code is checked on the server, not in the browser — so it can't be read out
of the page or bypassed by editing anything client-side. Wrong guesses are
limited to 5 per hour per person, which makes brute-forcing a 4-digit code
impractical.

**Send the code separately from the link.** A link forwarded into a big WhatsApp
group is only as private as that group; the code is what actually protects you.

**New link** rotates the code and instantly kills the old link — use it if a
link leaks somewhere it shouldn't have.

## Honest limitations

- **Notifications only fire for new expenses**, not comments or settlements.
  Easy to extend later, kept narrow for now so there's less to go wrong.
- **If someone's phone is offline**, the notification is delivered when they
  reconnect (that's handled by Apple/Google, not us) — but there's no in-app
  history of missed notifications beyond the Activity tab.
- **iOS in the EU:** Apple disabled home-screen web apps for EU users under the
  DMA, which also removes notification support there. Not an issue in India, but
  worth knowing if anyone in the group is travelling long-term in Europe.
