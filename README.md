# MINDMAZE — Online Competition Quiz Web Application
**Event:** TANTRA 2026  
**Presented by:** ENIGMA

MINDMAZE is a live college tech-fest quiz application with a central Supabase database, server-side score calculation, a shared public leaderboard, one official attempt per participant, and an organizer-only admin portal.

## Project structure

```text
MINDMAZE/
├── index.html
├── register.html
├── quiz.html
├── result.html
├── leaderboard.html
├── admin.html
├── css/
├── js/
│   ├── supabase-config.js
│   ├── app.js
│   ├── questions.js
│   ├── quiz.js
│   ├── result.js
│   ├── leaderboard.js
│   └── admin.js
├── assets/
└── supabase-schema.sql
```

## Supabase setup

### 1. Create the project

Create a Supabase project named `MINDMAZE-TANTRA2026`.

### 2. Run the schema

In **Supabase Dashboard → SQL Editor → New Query**:

1. Open `supabase-schema.sql` from this project.
2. Copy the entire file.
3. Paste it into the SQL Editor.
4. Click **Run**.

**Important:** This setup script drops and recreates the MINDMAZE tables/functions. It is intended for setup before the competition goes live. Do not rerun it after real competition data has been collected unless you intentionally want to erase that data.

The schema creates:

- `participants` — private participant records and a private access token.
- `attempts` — official submitted results, one per participant.
- `leaderboard_view` — the only public leaderboard data source.
- `register_participant()` — secure public registration RPC.
- `start_quiz_session()` — server-authoritative quiz start time.
- `submit_quiz_attempt()` — server-side answer evaluation and result storage.
- `is_mindmaze_admin()` — organizer authorization check.
- Row Level Security policies that block public table access and allow only admins to manage data.

### 3. Configure the frontend

Open `js/supabase-config.js` and replace the placeholders with the Supabase **Project URL** and **anon/publishable public key** from **Project Settings → API**.

Never put a Supabase service-role/secret key in this file or anywhere in the frontend.

### 4. Create the organizer account

In **Supabase → Authentication → Users**, create the organizer email/password account.

Then, in Supabase SQL Editor, run the following once, replacing the email with the organizer's exact email:

```sql
UPDATE auth.users
SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
WHERE email = 'YOUR-ADMIN-EMAIL@example.com';
```

The admin portal will only allow accounts whose Auth `app_metadata.role` is `admin`.

### 5. Test before going live

Use two separate browser profiles/devices and verify:

- Participant A can register.
- Participant B can register.
- Both can see the same leaderboard.
- A participant cannot read phone numbers through the public site.
- A participant cannot edit/delete/clear scores.
- A participant cannot submit a second official attempt.
- The score is calculated by Supabase, not by browser JavaScript.
- The official time is calculated from the server-side quiz start time.
- Only the organizer admin account can use the admin management functions.

## Security model

### Public participants

Participants can:

- Register through the secure registration RPC.
- Start/resume their own quiz session using their private participant token.
- Submit raw answers once.
- Read the public leaderboard.

Participants cannot:

- Read the `participants` table.
- Read phone numbers.
- Directly insert/update/delete `attempts`.
- Change scores.
- Delete leaderboard entries.
- Clear the leaderboard.
- Manage other participants.

### Organizer

The organizer uses Supabase Auth and must have `app_metadata.role = admin`. Only an admin can access participant/result management operations through the database RLS policies.

## Score and timer security

The browser sends raw answers to `submit_quiz_attempt()`. The official answer key is stored inside the PostgreSQL function, so the browser does not choose the score.

The official completion time is calculated from the server-side `quiz_started_at` timestamp and capped at 15 minutes. The browser cannot submit an arbitrary completion time.

If Supabase is unavailable, the quiz does **not** create a local official score. This prevents a browser-only fallback from becoming a way to forge results.

## Public leaderboard

`leaderboard.html` always reads from `leaderboard_view`. There is intentionally no localStorage fallback for the official leaderboard.

Ranking is:

1. Highest score first.
2. Lowest official server-calculated completion time second.

Phone numbers and other private participant fields are not included in the public view.

## Deployment

This project is compatible with static hosting such as GitHub Pages because the frontend is HTML/CSS/JavaScript and communicates with Supabase over HTTPS.

After testing locally:

```bash
git add .
git commit -m "Secure MINDMAZE Supabase competition backend"
git push origin main
```

Then enable GitHub Pages from the repository's **Settings → Pages** using the `main` branch and repository root.

## Important

Do not publish the final competition link until the Supabase schema has been installed, the frontend credentials have been configured, the organizer account has been assigned the `admin` role, and the complete registration → quiz → result → leaderboard flow has been tested from a separate participant browser/device.
