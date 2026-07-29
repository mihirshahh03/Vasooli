# TripSplit

A trip expense splitter built for messy real-world splits: equal, custom subgroups
(e.g. "only these 5 people"), and per-unit consumption (e.g. "Corona ₹200/bottle,
Hardik had 2, Ragina had 5"). Includes an audit check that flags when itemized
shares don't add up to a stated total.

## 1. Set up the database (Supabase)

1. Go to supabase.com → sign up (free, no card) → **New Project**
2. Name it, pick a region, set a DB password → wait ~2 min for it to spin up
3. In the dashboard, open **SQL Editor → New Query**, paste the entire contents of
   `schema.sql` (in this folder), and click **Run**. This creates all the tables
   and seeds your 8 friends' names.
4. Go to **Project Settings → API** and copy:
   - **Project URL**
   - **anon public key**

## 2. Run it locally (optional, to test before deploying)

```bash
npm install
cp .env.example .env
# paste your Project URL and anon key into .env
npm run dev
```

Open the printed localhost URL. Log in as any of the 8 names — first login for
each person prompts them to set their own 4-digit PIN.

## 3. Deploy for real (Vercel)

1. Push this folder to a new GitHub repository (create one on github.com, then
   `git init`, `git add .`, `git commit -m "init"`, `git remote add origin <your-repo-url>`,
   `git push -u origin main`)
2. Go to vercel.com → sign up with GitHub → **Add New Project** → import this repo
3. Before deploying, add environment variables (Vercel will show a field for this):
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
4. Click **Deploy**. In under a minute you'll get a live URL like
   `tripsplit-yourname.vercel.app`.

Share that link with your 7 friends. On iPhone: open it in Safari, tap **Share →
Add to Home Screen** to get the app icon (iOS doesn't offer this automatically —
it's a one-time manual step).

## Notes & honest limitations

- **Login security:** name + 4-digit PIN, hashed in-browser before it's stored.
  This is "trusted friend group" security, not bank-grade — fine for a private
  app link only your friends know about, not meant to withstand a determined attacker.
- **Offline v1:** the app shell loads and shows your last-synced data even with
  no signal. Adding a *new* expense while fully offline isn't supported yet
  (planned as a fast follow, not in this version).
- **Supabase free tier:** pauses your project after 7 days of no activity —
  no data lost, just click "Resume" in the Supabase dashboard before your next trip.
- **Trip members:** every new trip currently includes all 8 profiles by default.
  If your friend group changes trip to trip, this is the one place in the code
  (`Dashboard.jsx`, `createTrip`) you'd adjust to pick members per trip.
