# Vasooli

Group expense splitting for real trips — including the messy splits Splitwise
handles badly: subgroup-only meals, per-unit consumption (drinks by the bottle),
and a built-in check that flags when itemised shares don't add up to the total.

Anyone can sign up. You create groups, add friends by username, and each group's
expenses are visible only to that group's members.

---

## 1. Set up the database

1. In your Supabase project, open **SQL Editor → New query**
2. Paste the entire contents of `schema.sql` and click **Run**

Safe to re-run: the script drops and recreates its own tables each time.

## 2. Turn off email confirmation (important)

People sign in with a username, not an email, so Supabase's confirmation emails
would go nowhere and block every signup.

1. Supabase → **Authentication** → **Sign In / Providers** → **Email**
2. Turn **Confirm email** OFF, and save

## 3. Get your keys

Supabase → **Project Settings → API**, copy:
- **Project URL**
- **anon public** key

## 4. Deploy on Vercel

1. Vercel → **Add New Project** → import your GitHub repo
2. Add two **Environment Variables**:
   - `VITE_SUPABASE_URL` — your Project URL
   - `VITE_SUPABASE_ANON_KEY` — your anon public key
3. **Deploy**

You'll get a live URL. Share it with anyone — they sign up themselves.

## 5. Add it to a phone home screen

- **iPhone:** open the URL in Safari → Share → **Add to Home Screen**
  (iOS never prompts automatically; this manual step is required.)
- **Android:** Chrome offers an install prompt, or Menu → **Install app**

---

## How it works

**Groups.** Anyone can create a group. Whoever creates it becomes its admin.
Any member can add more people by username; admins can remove anyone, and
everyone can remove themselves (leave).

**Split types.**
- *Equally* — pick who's included, the total divides between them
- *Set amounts* — type an exact amount per person for uneven splits
- *Per unit* — set a price per unit and a count per person (e.g. beer at
  ₹200 a bottle, one person had 2, another had 5)

**The maths check.** Tap "Check the maths" before saving and it compares the
sum of the individual shares against the total you typed, showing the gap if
there is one. It won't block you — it just refuses to let a wrong number pass
by unnoticed.

**Settle up.** Net balances are reduced to the smallest set of payments that
clears everyone, so nobody makes six separate transfers.

---

## Honest limitations

- **Privacy** is enforced by Postgres row-level security, so it holds even if
  someone queries the API directly — not just in the UI. Any signed-in user
  can look up whether a username exists (that's what makes "add by username"
  work), but they can't see your groups, members or expenses.
- **Offline:** the app opens and shows the last data it loaded, but adding an
  expense needs a connection. Full offline entry with sync-on-reconnect isn't
  built yet.
- **Supabase free tier** pauses a project after 7 days with no activity.
  Nothing is lost — click Resume in the dashboard.
- **No password reset** yet. Forgotten passwords need a manual reset from the
  Supabase dashboard (Authentication → Users).
- **No editing an expense** after saving — delete it and re-add. Deliberate
  for v1 to keep the share recalculation simple and correct.

## Running it locally (optional)

```bash
npm install
cp .env.example .env   # then paste your keys in
npm run dev
```
